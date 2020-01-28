// Description:
//   毎日ログインボーナスでもらった「めりたん」というポイントを使って遊ぶSlack用チャットボットゲーム

import { Robot, Response, Message } from 'hubot';
import { Sequelize, Op } from 'sequelize';
import moment from 'moment';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';
import { LoginBonus } from './models/loginBonuses';

import { Slack, SlackBot } from './types/meritum';

const LOGIN_BONUS_MERITUN = 100; // ログインボーナス
const BOT_INITIAL_MERITUM = 20000; // ボットの初期めりたん
const MAX_JANKEN_BET = 20; // 最大ベット
const GACHA_MERITUM = 280; // ガチャ費用
const USER_INITIAL_MERITUM = GACHA_MERITUM + MAX_JANKEN_BET; // ユーザーの初期めりたん

/**
 * ログインボーナス受領日を取得する、午前7時に変わるため、7時間前の時刻を返す
 * @returns {Date} 7時間前の時刻
 */
function getReceiptToday(): Date {
  return new Date(Date.now() - 1000 * 60 * 60 * 7);
}

class MessageWithRawText extends Message {
  rawText?: string;
}

// DB同期
(async () => {
  await Account.sync();
  await LoginBonus.sync();
})();

module.exports = (robot: Robot<any>) => {
  // ヘルプ表示
  robot.hear(/^mhelp>$/i, (res: Response<Robot<any>>) => {
    res.send(
      '*プロジェクトmeritum* とは、 *めりたん* と *称号* を集めるプロジェクト。' +
        '毎日のログインボーナスを集めて、ガチャを回し、称号を集めよう。' +
        '他人に迷惑をかけたりしないように！ *めりたん* が消滅します！' +
        'めりたんbotをランキング100以下にしたらユーザーたちの勝利。\n' +
        ':point_down::point_down::point_down::point_down:コマンド説明:point_down::point_down::point_down::point_down:\n' +
        '`mhelp>` : めりたんbotの使い方を表示。\n' +
        '`mlogin>` : ログインボーナスの *100めりたん* をゲット。毎朝7時にリセット。\n' +
        `\`mjanken> (グー|チョキ|パー) (1-${MAX_JANKEN_BET})\` : めりたんbotとめりたんを賭けてジャンケン。\n` +
        `\`mgacha>\` : *${GACHA_MERITUM}めりたん* でガチャを回し、称号をゲット。\n` +
        '`mself>` : 自分のめりたん、称号数、全称号、順位を表示。\n' +
        '`mranking>` : 称号数、次にめりたんで決まるランキングを表示。\n' +
        '`mrank> (@ユーザー名)` : 指定したユーザーのめりたん、称号数、全称号、順位を表示。\n' +
        '`msend> (@ユーザー名) (数値)` : 指定したユーザーに数値で指定しためりたんを送る'
    );
  });

  // ログインボーナス
  robot.hear(/^mlogin>$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slackId = user.id;
    const name = user.name;
    const realName = user.real_name;
    const slack = user.slack as Slack;
    const displayName = slack.profile.display_name;

    const t = await database.transaction();
    try {
      const receiptDate = getReceiptToday();
      const countLoginBonus = await LoginBonus.count({
        where: {
          slackId: slackId,
          receiptDate: {
            [Op.eq]: receiptDate
          }
        }
      });

      if (countLoginBonus === 1) {
        // 取得済み
        await t.commit();
        res.send(
          `<@${slackId}>さんは、既に本日のログインボーナスを取得済みです。`
        );
      } else {
        // 付与へ
        // アカウントがない場合には作り、100めりたん付与、ログインボーナス実績を追加
        const oldAccount = await Account.findByPk(slackId);
        let meritum = 0;
        if (!oldAccount) {
          meritum = LOGIN_BONUS_MERITUN + USER_INITIAL_MERITUM;
          await Account.create({
            slackId,
            name,
            realName,
            displayName,
            meritum,
            titles: '',
            numOfTitles: 0
          });
        } else {
          meritum = oldAccount.meritum + LOGIN_BONUS_MERITUN;
          // ログインボーナス取得時にユーザー名などを更新
          await Account.update(
            {
              name,
              realName,
              displayName,
              meritum
            },
            {
              where: {
                slackId: slackId
              }
            }
          );
        }

        // ログインボーナス実績を作成
        await LoginBonus.create({
          slackId,
          receiptDate
        });

        await t.commit();
        res.send(
          `<@${slackId}>さんにログインボーナスとして *${LOGIN_BONUS_MERITUN}めりたん* を付与し、 *${meritum}めりたん* となりました。`
        );
      }
    } catch (e) {
      console.log('Error on mlogin> e:');
      console.log(e);
      await t.rollback();
    }
  });

  // ジャンケン
  robot.hear(
    /^mjanken> (グー|チョキ|パー) (\d+)$/i,
    async (res: Response<Robot<any>>) => {
      const user = res.message.user;
      const slackId = user.id;
      const name = user.name;
      const realName = user.real_name;
      const slack = user.slack as Slack;
      const displayName = slack.profile.display_name;
      const slackBot = robot.adapter as SlackBot;

      const hand = res.match[1];
      const bet = parseInt(res.match[2]);

      if (bet > MAX_JANKEN_BET) {
        res.send(
          `*${MAX_JANKEN_BET}めりたん* 以上をかけてジャンケンすることは禁止されています。`
        );
        return;
      }

      if (bet <= 0) {
        res.send(
          '*1めりたん* より小さな数の *めりたん* をかけることはできません。'
        );
        return;
      }

      const t = await database.transaction();
      try {
        // ボット自身に最低でも10めりたんあるかチェック
        let botAccount = await Account.findByPk(slackBot.self.id);
        if (!botAccount) {
          // ボットアカウントがない場合作る
          await Account.create({
            slackId: slackBot.self.id,
            name: slackBot.self.name,
            realName: '',
            displayName: '',
            meritum: BOT_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          });
          botAccount = await Account.findByPk(slackBot.self.id);
        } else if (botAccount.meritum < bet) {
          // ベット分持っていない場合、終了
          res.send(
            `<@${slackBot.self.id}>は *${bet}めりたん* を所有していないためジャンケンできません。`
          );
          await t.commit();
          return;
        }

        // ボットアカウントがない場合に作成してもまだないなら終了
        if (!botAccount) {
          res.send('ボットアカウントを作成することができませんでした。');
          console.log('ボットアカウントを作成することができませんでした。');
          await t.commit();
          return;
        }

        // 相手がベットできるかチェック
        let account = await Account.findByPk(slackId);
        if (!account) {
          // アカウントがない場合作る
          const meritum = 0;
          await Account.create({
            slackId,
            name,
            realName,
            displayName,
            meritum: USER_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          });
          account = await Account.findByPk(slackId);
        } else if (account.meritum < bet) {
          // ベット分持っていない場合、終了
          res.send(
            `<@${slackId}>は *${bet}めりたん* を所有していないためジャンケンできません。`
          );
          await t.commit();
          return;
        }

        // アカウントがない場合に作成してもまだないなら終了
        if (!account) {
          res.send('アカウントを作成することができませんでした。');
          console.log('アカウントを作成することができませんでした。');
          await t.commit();
          return;
        }

        const botHands = ['グー', 'チョキ', 'パー'];
        const botHand = botHands[Math.floor(Math.random() * botHands.length)];

        if (botHand === hand) {
          res.send(
            `ジャンケン！ ${botHand}！... *あいこ* ですね。またの機会に。`
          );
          await t.commit();
          return;
        }

        const isBotWon =
          (botHand === 'グー' && hand === 'チョキ') ||
          (botHand === 'チョキ' && hand === 'パー') ||
          (botHand === 'パー' && hand === 'グー');

        if (isBotWon) {
          // 負け処理
          await Account.update(
            { meritum: account.meritum - bet },
            {
              where: {
                slackId: slackId
              }
            }
          );
          await Account.update(
            { meritum: botAccount.meritum + bet },
            {
              where: {
                slackId: slackBot.self.id
              }
            }
          );
          res.send(
            `ジャンケン！ ${botHand}！...あなたの *負け* ですね。 *${bet}めりたん* 頂きます。これで *${account.meritum -
              bet}めりたん* になりました。`
          );
        } else {
          // 勝ち処理
          await Account.update(
            { meritum: account.meritum + bet },
            {
              where: {
                slackId: slackId
              }
            }
          );
          await Account.update(
            { meritum: botAccount.meritum - bet },
            {
              where: {
                slackId: slackBot.self.id
              }
            }
          );
          res.send(
            `ジャンケン！ ${botHand}！...あなたの *勝ち* ですね。 *${bet}めりたん* お渡しします。これで *${account.meritum +
              bet}めりたん* になりました。`
          );
        }
        await t.commit();
      } catch (e) {
        console.log('Error on mjanken> e:');
        console.log(e);
        await t.rollback();
      }
    }
  );

  // ガチャ
  robot.hear(/^mgacha>$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slackId = user.id;
    const name = user.name;
    const realName = user.real_name;
    const slack = user.slack as Slack;
    const displayName = slack.profile.display_name;

    const t = await database.transaction();
    try {
      // 相手がガチャできるかチェック
      let account = await Account.findByPk(slackId);
      if (!account) {
        // アカウントがない場合作る
        const meritum = 0;
        await Account.create({
          slackId,
          name,
          realName,
          displayName,
          meritum: USER_INITIAL_MERITUM,
          titles: '',
          numOfTitles: 0
        });
        account = await Account.findByPk(slackId);
      } else if (account.meritum < GACHA_MERITUM) {
        // ガチャ費用を持っていない場合、終了
        res.send(
          `<@${slackId}>は、ガチャ費用 *${GACHA_MERITUM}めりたん* を所有していないためガチャできません。`
        );
        await t.commit();
        return;
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!account) {
        res.send('アカウントを作成することができませんでした。');
        console.log('アカウントを作成することができませんでした。');
        await t.commit();
        return;
      }

      const titles = [
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'G',
        'H',
        'I',
        'J',
        'K',
        'L',
        'M',
        'N',
        'O',
        'P',
        'Q',
        'L',
        'S',
        'T',
        'U',
        'V',
        'W',
        'X',
        'Y',
        'Z'
      ];
      const title = titles[Math.floor(Math.random() * titles.length)];

      let newTitles = account.titles.split('');
      newTitles.push(title);
      newTitles = Array.from(new Set(newTitles)).sort();
      const newTitlesStr = newTitles.join('');

      // 支払い処理と称号追加
      const newMeritum = account.meritum - GACHA_MERITUM;
      await Account.update(
        {
          meritum: newMeritum,
          titles: newTitlesStr,
          numOfTitles: newTitlesStr.length
        },
        {
          where: {
            slackId: slackId
          }
        }
      );

      await t.commit();
      res.send(
        `称号 *${title}* を手に入れました！ 称号数は *${newTitlesStr.length}個* 、全称号は *${newTitlesStr}* 、 *${newMeritum}めりたん* となりました。`
      );
    } catch (e) {
      console.log('Error on mgacha> e:');
      console.log(e);
      await t.rollback();
    }
  });

  // 自分のデータ表示
  robot.hear(/^mself>$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slackId = user.id;
    const name = user.name;
    const realName = user.real_name;
    const slack = user.slack as Slack;
    const displayName = slack.profile.display_name;

    const t = await database.transaction();
    try {
      let account = await Account.findByPk(slackId);
      if (!account) {
        // アカウントがない場合作る
        await Account.create({
          slackId,
          name,
          realName,
          displayName,
          meritum: USER_INITIAL_MERITUM,
          titles: '',
          numOfTitles: 0
        });
        account = await Account.findByPk(slackId);
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!account) {
        res.send('アカウントを作成することができませんでした。');
        console.log('アカウントを作成することができませんでした。');
        await t.commit();
        return;
      }

      const accounts = await Account.findAll({
        order: [
          ['numOfTitles', 'DESC'],
          ['meritum', 'DESC']
        ],
        attributes: ['slackId']
      });

      let rank = 1;
      for (const a of accounts) {
        if (a.slackId === slackId) {
          break;
        } else {
          rank++;
        }
      }

      await t.commit();
      const titlesWithAlt = account.titles || 'なし';
      res.send(
        `あなたの順位は *第${rank}位* 、 称号数は *${account.numOfTitles}個* 、全称号は *${titlesWithAlt}* 、 *${account.meritum}めりたん* です。`
      );
    } catch (e) {
      console.log('Error on mself> e:');
      console.log(e);
      await t.rollback();
    }
  });

  // 自分のデータ表示
  robot.hear(/^mranking>$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slack = user.slack as Slack;

    const t = await database.transaction();
    try {
      const accounts = await Account.findAll({
        order: [
          ['numOfTitles', 'DESC'],
          ['meritum', 'DESC']
        ],
        limit: 100
      });
      await t.commit();

      let message = ':crown:めりたん称号ランキング:crown:\n';
      let botSlackId = (robot.adapter as SlackBot).self.id;
      let isUserWon = true;
      let rank = 1;
      for (const a of accounts) {
        if (botSlackId === a.slackId) isUserWon = false;
        let rankName = a.displayName || a.realName;
        rankName = rankName || a.name;
        message += `*第${rank}位* ${rankName} (称号数: ${a.numOfTitles}、めりたん: ${a.meritum})\n`;
        rank++;
      }

      if (isUserWon) {
        message +=
          '\n:tada:めりたんbotをランキングから排除してユーザーたちが勝利しました！:tada:';
      }

      res.send(message);
    } catch (e) {
      console.log('Error on mranking> e:');
      console.log(e);
      await t.rollback();
    }
  });

  // 他人のデータ表示
  robot.hear(/^mrank> (.+)/i, async (res: Response<Robot<any>>) => {
    const rawText = (res.message as MessageWithRawText).rawText;
    if (!rawText) {
      res.send('rawTextが正しく取得でいませんでした。');
      return;
    }

    const parsed = rawText.match(/^mrank&gt; <@(.+)>.*/);
    if (!parsed) {
      res.send('コマンドの形式が `mrank> (@ユーザー名)` ではありません。');
      return;
    }

    const slackId = parsed[1];

    const t = await database.transaction();
    try {
      let account = await Account.findByPk(slackId);
      if (!account) {
        res.send('指定したユーザーはプロジェクトmeritumをやっていません。');
        await t.commit();
        return;
      }

      const accounts = await Account.findAll({
        order: [
          ['numOfTitles', 'DESC'],
          ['meritum', 'DESC']
        ],
        attributes: ['slackId']
      });

      let rank = 1;
      for (const a of accounts) {
        if (a.slackId === slackId) {
          break;
        } else {
          rank++;
        }
      }

      await t.commit();
      const titlesWithAlt = account.titles || 'なし';
      res.send(
        `<@${slackId}>の順位は *第${rank}位* 、 称号数は *${account.numOfTitles}個* 、全称号は *${titlesWithAlt}* 、 *${account.meritum}めりたん* です。`
      );
    } catch (e) {
      console.log('Error on mrank> e:');
      console.log(e);
      await t.rollback();
    }
  });

  // 他人にめりたんを送る
  robot.hear(/^msend> (.+) (\d+)/i, async (res: Response<Robot<any>>) => {
    const rawText = (res.message as MessageWithRawText).rawText;
    if (!rawText) {
      res.send('rawTextが正しく取得でいませんでした。');
      return;
    }

    const parsed = rawText.match(/^msend&gt; <@(.+)> (\d+)/);
    if (!parsed) {
      res.send(
        'コマンドの形式が `msend> (@ユーザー名) (数値)` ではありません。'
      );
      return;
    }

    const toSlackId = parsed[1];
    const sendMeritum = parseInt(parsed[2]);

    if (sendMeritum <= 0) {
      res.send('0以下のめりたんを送ることはできません。');
      return;
    }

    const t = await database.transaction();
    try {
      let toAccount = await Account.findByPk(toSlackId);
      if (!toAccount) {
        res.send('指定したユーザーはプロジェクトmeritumをやっていません。');
        await t.commit();
        return;
      }

      const fromUser = res.message.user;
      const fromSlackId = fromUser.id;
      const name = fromUser.name;
      const realName = fromUser.real_name;
      const slack = fromUser.slack as Slack;
      const displayName = slack.profile.display_name;

      if (fromSlackId === toSlackId) {
        res.send('自身へはめりたんを送ることはできません。');
        await t.commit();
        return;
      }

      let fromAccount = await Account.findByPk(fromSlackId);

      if (!fromAccount) {
        // アカウントがない場合作る
        await Account.create({
          fromSlackId,
          name,
          realName,
          displayName,
          meritum: USER_INITIAL_MERITUM,
          titles: '',
          numOfTitles: 0
        });
        fromAccount = await Account.findByPk(fromSlackId);
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!fromAccount) {
        res.send('アカウントを作成することができませんでした。');
        console.log('アカウントを作成することができませんでした。');
        await t.commit();
        return;
      }

      if (fromAccount.meritum < sendMeritum) {
        // 送るめりたんを持っていない場合、終了
        res.send(
          `<@${fromSlackId}>は、送るための *${sendMeritum}めりたん* を所有していません。`
        );
        await t.commit();
        return;
      }

      // 送付処理
      await Account.update(
        { meritum: fromAccount.meritum - sendMeritum },
        {
          where: {
            slackId: fromSlackId
          }
        }
      );
      await Account.update(
        { meritum: toAccount.meritum + sendMeritum },
        {
          where: {
            slackId: toSlackId
          }
        }
      );

      res.send(
        `<@${fromSlackId}> から  <@${toSlackId}> に *${sendMeritum}めりたん* を送り、<@${fromSlackId}> は *${fromAccount.meritum -
          sendMeritum}めりたん* に、 <@${toSlackId}> は *${toAccount.meritum +
          sendMeritum}めりたん* になりました。`
      );
    } catch (e) {
      console.log('Error on msend> e:');
      console.log(e);
      await t.rollback();
    }
  });
};
