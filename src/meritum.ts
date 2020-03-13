// Description:
//   毎日ログインボーナスでもらった「めりたん」というポイントを使って遊ぶSlack用チャットボットゲーム

import { Robot, Response, Message } from 'hubot';
import { Sequelize, Op } from 'sequelize';
import moment from 'moment';
import { WebClient, AttachmentAction } from '@slack/web-api';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';
import { LoginBonus } from './models/loginBonuses';
import { Omikuji } from './models/omikuji';

import { Slack, SlackBot, UserJankenSession, MRobot } from './types/meritum';

import {
  ChatPostMessageResponse
} from 'seratch-slack-types/web-api';

const LOGIN_BONUS_MERITUN = 100; // ログインボーナス
const BOT_INITIAL_MERITUM = 20000; // ボットの初期めりたん
const MAX_JANKEN_BET = 20; // 最大ベット
const MAX_USER_JANKEN_BET = 200; // ユーザー同士ジャンケンの最大ベット
const LIMIT_TIME_SEC_USER_JANKEN = 60; // ユーザー同士のジャンケンがキャンセルになる時間
const GACHA_MERITUM = 280; // ガチャ費用
const OMIKUJI_MERITUM = 10; // おみくじ費用
const USER_INITIAL_MERITUM = GACHA_MERITUM + MAX_JANKEN_BET; // ユーザーの初期めりたん

const web = new WebClient(process.env.HUBOT_SLACK_TOKEN);

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
  await Omikuji.sync();
})();

module.exports = (robot: MRobot<any>) => {
  // ヘルプ表示
  robot.hear(/^mhelp>$/i, (res: Response<Robot<any>>) => {
    res.send(
      '*プロジェクトmeritum* とは、 *めりたん* と *称号* を集めるプロジェクト。' +
      '毎日のログインボーナスを集めて、ガチャを回し、称号を集めよう。' +
      '他人に迷惑をかける行為はしないでね。 *めりたん* が消滅します！' +
      'めりたんbotをランキング101位以下にしたらユーザーたちの勝利です。\n' +
      ':point_down::point_down::point_down::point_down: *〜コマンド説明〜* :point_down::point_down::point_down::point_down:\n' +
      '`mhelp>` : めりたんbotの使い方を表示。\n' +
      '`mlogin>` : ログインボーナスの *100めりたん* をゲット。毎朝7時にリセット。\n' +
      `\`mjanken> (グー|チョキ|パー) (1-${MAX_JANKEN_BET})\` : めりたんbotとめりたんを賭けてジャンケン。\n` +
      `\`muj> (@ユーザー名) (1-${MAX_USER_JANKEN_BET})\` : 指定したユーザーとめりたんを賭けてジャンケン。\n` +
      `\`mgacha>\` : *${GACHA_MERITUM}めりたん* でガチャを回し、称号をゲット。\n` +
      `\`mmikuji>\` : *${OMIKUJI_MERITUM}めりたん* でおみくじを引き、今日の運勢を占って景品をもらおう。\n` +
      '`mself>` : 自分の順位、称号数、全称号、めりたんを表示。\n' +
      '`mranking>` : 称号数で決まるランキングを表示(同称号数なら、めりたんの数順)。\n' +
      '`mrank> (@ユーザー名)` : 指定したユーザーの順位、称号数、全称号、めりたんを表示。\n' +
      '`msend> (@ユーザー名) (数値)` : 指定したユーザーに数値で指定しためりたんを送る。'
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
            [Op.eq]: moment(receiptDate).format()
          }
        },
        transaction: t
      });

      if (countLoginBonus === 1) {
        // 取得済み
        await t.commit();
        res.send(
          `<@${slackId}>ちゃんは、既に今日のログインボーナスをゲット済みだよ。`
        );
      } else {
        // 付与へ
        // アカウントがない場合には作り、100めりたん付与、ログインボーナス実績を追加
        const oldAccount = await Account.findByPk(slackId, { transaction: t });
        let meritum = 0;
        if (!oldAccount) {
          meritum = LOGIN_BONUS_MERITUN + USER_INITIAL_MERITUM;
          await Account.create(
            {
              slackId,
              name,
              realName,
              displayName,
              meritum,
              titles: '',
              numOfTitles: 0
            },
            { transaction: t }
          );
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
              },
              transaction: t
            }
          );
        }

        // ログインボーナス実績を作成
        await LoginBonus.create({
          slackId,
          receiptDate
        }),
          { transaction: t };

        await t.commit();
        res.send(
          `<@${slackId}>ちゃんに、ログインボーナスとして *${LOGIN_BONUS_MERITUN}めりたん* をプレゼント。これで *${meritum}めりたん* になったよ。`
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
          `*${MAX_JANKEN_BET}めりたん* より大きい数をかけてジャンケンすることは禁止されているよ。`
        );
        return;
      }

      if (bet <= 0) {
        res.send(
          '*1めりたん* より小さな数の *めりたん* をかけることはできないよ。'
        );
        return;
      }

      const t = await database.transaction();
      try {
        // ボット自身に最低でも10めりたんあるかチェック
        let botAccount = await Account.findByPk(slackBot.self.id, {
          transaction: t
        });
        if (!botAccount) {
          // ボットアカウントがない場合作る
          await Account.create(
            {
              slackId: slackBot.self.id,
              name: slackBot.self.name,
              realName: '',
              displayName: '',
              meritum: BOT_INITIAL_MERITUM,
              titles: '',
              numOfTitles: 0
            },
            { transaction: t }
          );
          botAccount = await Account.findByPk(slackBot.self.id, {
            transaction: t
          });
        } else if (botAccount.meritum < bet) {
          // ベット分持っていない場合、終了
          res.send(
            `<@${slackBot.self.id}>は *${bet}めりたん* をもっていないよ。`
          );
          await t.commit();
          return;
        }

        // ボットアカウントがない場合に作成してもまだないなら終了
        if (!botAccount) {
          res.send('ボットアカウントを作成することができなかったみたい。');
          console.log('ボットアカウントを作成することができなかったみたい。');
          await t.commit();
          return;
        }

        // 相手がベットできるかチェック
        let account = await Account.findByPk(slackId, { transaction: t });
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
          }),
            { transaction: t };
          account = await Account.findByPk(slackId, { transaction: t });
        } else if (account.meritum < bet) {
          // ベット分持っていない場合、終了
          res.send(
            `<@${slackId}>ちゃんは *${bet}めりたん* がないからジャンケンできないよ。`
          );
          await t.commit();
          return;
        }

        // アカウントがない場合に作成してもまだないなら終了
        if (!account) {
          res.send('アカウントを作成することができなかったみたい。');
          console.log('アカウントを作成することができなかったみたい。');
          await t.commit();
          return;
        }

        const botHands = ['グー', 'チョキ', 'パー'];
        const botHand = botHands[Math.floor(Math.random() * botHands.length)];

        if (botHand === hand) {
          res.send(
            `ジャンケン！ ${botHand}！... *あいこ* だね。またチャレンジしてね。`
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
              },
              transaction: t
            }
          );
          await Account.update(
            { meritum: botAccount.meritum + bet },
            {
              where: {
                slackId: slackBot.self.id
              },
              transaction: t
            }
          );
          res.send(
            `ジャンケン！ ${botHand}！...<@${slackId}>ちゃんの *負け* だよ。 *${bet}めりたん* もらうね。これで *${account.meritum -
            bet}めりたん* になったよ。`
          );
        } else {
          // 勝ち処理
          await Account.update(
            { meritum: account.meritum + bet },
            {
              where: {
                slackId: slackId
              },
              transaction: t
            }
          );
          await Account.update(
            { meritum: botAccount.meritum - bet },
            {
              where: {
                slackId: slackBot.self.id
              },
              transaction: t
            }
          );
          res.send(
            `ジャンケン！ ${botHand}！...<@${slackId}>ちゃんの *勝ち* だよ。 *${bet}めりたん* をあげるね。これで *${account.meritum +
            bet}めりたん* になったよ。`
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

  // キーはユーザーのDMのルームIDとなっているセッションの連想配列
  const mapUserJankenSession = new Map<string, UserJankenSession>();

  // ユーザーとめりたんを賭けてジャンケン
  robot.hear(/^muj> (.+) (\d+)/i, async (res: Response<Robot<any>>) => {
    const rawText = (res.message as MessageWithRawText).rawText;
    if (!rawText) {
      res.send('rawTextが正しく取得でいないみたい。');
      return;
    }

    const parsed = rawText.match(/^muj&gt; <@(.+)> (\d+)/);
    if (!parsed) {
      res.send(
        'コマンドの形式が `muj> (@ユーザー名) (数値)` ではないみたい。'
      );
      return;
    }

    const opponentSlackId = parsed[1];
    const sendMeritum = parseInt(parsed[2]);

    if (sendMeritum <= 0) {
      res.send('0以下のめりたんをかけてジャンケンはできないよ。');
      return;
    }

    if (sendMeritum > MAX_USER_JANKEN_BET) {
      res.send(`*${MAX_USER_JANKEN_BET}めりたん* 以上をかけてジャンケンすることは禁止されているよ。`);
      return;
    }

    const t = await database.transaction();
    try {
      let opponentAccount = await Account.findByPk(opponentSlackId, { transaction: t });
      if (!opponentAccount) {
        res.send('指定したユーザーはプロジェクトmeritumをやってないみたい。');
        await t.commit();
        return;
      }

      if (opponentAccount.meritum < sendMeritum) {
        // 賭けるめりたんを持っていない場合、終了
        res.send(
          `<@${opponentSlackId}>は、賭けるための *${sendMeritum}めりたん* をもってないみたいだよ。`
        );
        await t.commit();
        return;
      }

      const myUser = res.message.user;
      const mySlackId = myUser.id;
      const name = myUser.name;
      const realName = myUser.real_name;
      const slack = myUser.slack as Slack;
      const displayName = slack.profile.display_name;

      let myAccount = await Account.findByPk(mySlackId, { transaction: t });

      if (!myAccount) {
        // アカウントがない場合作る
        await Account.create({
          slackId: mySlackId,
          name,
          realName,
          displayName,
          meritum: USER_INITIAL_MERITUM,
          titles: '',
          numOfTitles: 0
        }),
          { transaction: t };
        myAccount = await Account.findByPk(mySlackId, { transaction: t });
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!myAccount) {
        res.send('ユーザーが作成できなかったみたい。');
        await t.commit();
        return;
      }

      if (myAccount.meritum < sendMeritum) {
        // 送るめりたんを持っていない場合、終了
        res.send(
          `<@${mySlackId}>は、賭けるための *${sendMeritum}めりたん* をもってないみたいだよ。`
        );
        await t.commit();
        return;
      }

      // @username から sendMeritum を賭けたジャンケンの誘いが来ています。30秒以内に
      const chatPostMessageResponse = await web.chat.postMessage({
        channel: opponentSlackId,
        text: `<@${mySlackId}>ちゃんから  *${sendMeritum}めりたん* を賭けたジャンケンに招待されたよ。60秒以内に手を選択しない場合には勝負はキャンセルになるよ。`,
        as_user: true
      }) as ChatPostMessageResponse;
      const channel = chatPostMessageResponse.channel;
      const timestamp = chatPostMessageResponse.message?.ts

      if (!channel || !timestamp) {
        res.send('ジャンケンの招待ができなかったみたい。');
        await t.commit();
        return;
      }

      await web.reactions.add({ channel, name: 'fist', timestamp });
      await web.reactions.add({ channel, name: 'v', timestamp });
      await web.reactions.add({ channel, name: 'raised_hand_with_fingers_splayed', timestamp });
      await web.reactions.add({ channel, name: 'x', timestamp });

      // セションを作成
      const session = {
        status: 'offering',
        startChannel: (res.message as any).room,
        opponentChannel: channel,
        opponentTimestamp: timestamp,
        me: mySlackId,
        opponent: opponentSlackId,
        offeredTime: Date.now(),
        sendMeritum
      } as UserJankenSession;
      mapUserJankenSession.set(channel, session);

      await t.commit();
      res.send(
        `<@${mySlackId}>ちゃんから<@${opponentSlackId}>ちゃんへ *${sendMeritum}めりたん* を賭けたジャンケンの招待を送ったよ。`
      );

      // 60 秒後に敵の手が決まってないままだったらキャンセル
      setTimeout(async () => {
        if (session.status === 'offering') {
          mapUserJankenSession.delete(channel);
          await web.chat.postMessage({
            channel: session.startChannel,
            text: `<@${opponentSlackId}>ちゃんは、${LIMIT_TIME_SEC_USER_JANKEN}秒で手を決められなかったので勝負はキャンセルになったよ。`,
            as_user: true
          }) as ChatPostMessageResponse;
        }
      }, LIMIT_TIME_SEC_USER_JANKEN * 1000)

    } catch (e) {
      console.log('Error on muj> e:');
      console.log(e);
      await t.rollback();
    }
  });

  // ジャンケンの結果の受け取り
  robot.react(async (res: Response<Robot<any>>) => {
    const message = res.message as any;
    const session = mapUserJankenSession.get(message.room);

    if (message.type === 'added' && message.reaction === 'x' && session) {
      const cancellerSlackId = res.message.user.id;
      await web.chat.postMessage({
        channel: session.opponentChannel,
        text: `<@${cancellerSlackId}>ちゃんが相手とのジャンケンをキャンセルしたみたい。`,
        as_user: true
      }) as ChatPostMessageResponse;
      return;
    }

    if (message.type === 'added' &&
      session && (
        message.reaction === 'fist' ||
        message.reaction === 'v' ||
        message.reaction === 'raised_hand_with_fingers_splayed'
      )) {

      if (session.status === 'offering') { // 敵の手が決まってない場合
        const opponentSlackId = res.message.user.id;
        const opponentHand = message.reaction;
        session.opponentHand = message.reaction;

        await web.chat.postMessage({
          channel: session.opponentChannel,
          text: `<@${opponentSlackId}>ちゃんの手は :${opponentHand}: になりました。 <@${session.me}>ちゃんの手を待ちます。`,
          as_user: true
        }) as ChatPostMessageResponse;

        const chatPostMessageResponse = await web.chat.postMessage({
          channel: session.me,
          text: `<@${opponentSlackId}>ちゃんとの  *${session.sendMeritum}めりたん* を賭けたジャンケンをするよ。${LIMIT_TIME_SEC_USER_JANKEN}秒以内に手を選択しない場合には勝負はキャンセルになるよ。`,
          as_user: true
        }) as ChatPostMessageResponse;
        const channel = chatPostMessageResponse.channel;
        const timestamp = chatPostMessageResponse.message?.ts

        if (!channel || !timestamp) {
          return;
        }

        await web.reactions.add({ channel, name: 'fist', timestamp });
        await web.reactions.add({ channel, name: 'v', timestamp });
        await web.reactions.add({ channel, name: 'raised_hand_with_fingers_splayed', timestamp });
        await web.reactions.add({ channel, name: 'x', timestamp });

        session.status = 'opponent_ready';
        mapUserJankenSession.set(channel, session);

        // 60 秒後に自身の手が決まってないままだったらキャンセル
        setTimeout(async () => {
          if (session.status === 'opponent_ready') {
            mapUserJankenSession.delete(channel);
            await web.chat.postMessage({
              channel: session.startChannel,
              text: `<@${session.me}>ちゃんは、${LIMIT_TIME_SEC_USER_JANKEN}秒で手を決められなかったので勝負はキャンセルになったよ。`,
              as_user: true
            }) as ChatPostMessageResponse;
          }
        }, LIMIT_TIME_SEC_USER_JANKEN * 1000)

      } else if (session.status === 'opponent_ready') { // 敵の手が決まっている場合

        const mySlackId = res.message.user.id;
        const myHand = message.reaction;

        // 流れ的には、敵が先に手を決めているけども、手はわからないのでこのこのメッセージ
        await web.chat.postMessage({
          channel: session.opponentChannel,
          text: `<@${mySlackId}>ちゃんの手は :${myHand}: になりました。 <@${session.opponent}>ちゃんの手を待ちます。`,
          as_user: true
        }) as ChatPostMessageResponse;

        const t = await database.transaction();
        try {
          let myAccount = await Account.findByPk(mySlackId, {
            transaction: t
          });

          // 自分に賭けに必要なめりたんがチェック
          if (!myAccount || myAccount.meritum < session.sendMeritum) {
            await web.chat.postMessage({
              channel: session.startChannel,
              text: `<@${myAccount?.slackId}>ちゃんはには *${session.sendMeritum}めりたん* なかったみたい。`,
              as_user: true
            }) as ChatPostMessageResponse;
            await t.commit();
            return;
          }

          // 相手に賭けに必要なめりたんがチェック
          let opponentAccount = await Account.findByPk(session.opponent, { transaction: t });
          if (!opponentAccount || opponentAccount.meritum < session.sendMeritum) {
            await web.chat.postMessage({
              channel: session.startChannel,
              text: `<@${opponentAccount?.slackId}>ちゃんはには *${session.sendMeritum}めりたん* なかったみたい。`,
              as_user: true
            }) as ChatPostMessageResponse;
            await t.commit();
            return;
          }

          if (myHand === session.opponentHand) {
            await web.chat.postMessage({
              channel: session.startChannel,
              text: `<@${mySlackId}>ちゃんは :${myHand}: 、<@${session.opponent}>ちゃんは :${session.opponentHand}: で、あいこだったよ。また勝負してね。`,
              as_user: true
            }) as ChatPostMessageResponse;
            await t.commit();
            return;
          }

          const isMyWin =
            (myHand === 'fist' && session.opponentHand === 'v') ||
            (myHand === 'v' && session.opponentHand === 'raised_hand_with_fingers_splayed') ||
            (myHand === 'raised_hand_with_fingers_splayed' && session.opponentHand === 'fist');

          if (isMyWin) {
            // 勝ち処理
            await Account.update(
              { meritum: opponentAccount.meritum - session.sendMeritum },
              {
                where: {
                  slackId: session.opponent
                },
                transaction: t
              }
            );
            await Account.update(
              { meritum: myAccount.meritum + session.sendMeritum },
              {
                where: {
                  slackId: mySlackId
                },
                transaction: t
              }
            );

            await web.chat.postMessage({
              channel: session.startChannel,
              text: `<@${mySlackId}>ちゃんは${myHand}、<@${session.opponent}>ちゃんは${session.opponentHand}で<@${mySlackId}>ちゃんの勝ち。<@${mySlackId}>ちゃんは *${myAccount.meritum + session.sendMeritum}めりたん* に 、<@${session.opponent}>ちゃんは *${opponentAccount.meritum - session.sendMeritum}めりたん* になったよ。`,
              as_user: true
            }) as ChatPostMessageResponse;
          } else {
            // 負け処理
            await Account.update(
              { meritum: opponentAccount.meritum + session.sendMeritum },
              {
                where: {
                  slackId: session.opponent
                },
                transaction: t
              }
            );
            await Account.update(
              { meritum: myAccount.meritum - session.sendMeritum },
              {
                where: {
                  slackId: mySlackId
                },
                transaction: t
              }
            );

            await web.chat.postMessage({
              channel: session.startChannel,
              text: `<@${mySlackId}>ちゃんは :${myHand}: 、<@${session.opponent}>ちゃんは :${session.opponentHand}: で<@${session.opponent}>ちゃんの勝ち。<@${mySlackId}>ちゃんは *${myAccount.meritum - session.sendMeritum}めりたん* に 、<@${session.opponent}>ちゃんは *${opponentAccount.meritum + session.sendMeritum}めりたん* になったよ。`,
              as_user: true
            }) as ChatPostMessageResponse;
          }
          await t.commit();
          session.status = 'finished';

        } catch (e) {
          console.log('Error on muj> e:');
          console.log(e);
          await t.rollback();
        }
      }
    }
  });

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
      let account = await Account.findByPk(slackId, { transaction: t });
      if (!account) {
        // アカウントがない場合作る
        await Account.create(
          {
            slackId,
            name,
            realName,
            displayName,
            meritum: USER_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          },
          { transaction: t }
        );
        account = await Account.findByPk(slackId, { transaction: t });
      } else if (account.meritum < GACHA_MERITUM) {
        // ガチャ費用を持っていない場合、終了
        res.send(
          `<@${slackId}>ちゃんは、ガチャ費用の *${GACHA_MERITUM}めりたん* がないからガチャできないよ。`
        );
        await t.commit();
        return;
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!account) {
        res.send('アカウントを作成することができないみたい。');
        console.log('アカウントを作成することができないみたい。');
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
        'R',
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
          },
          transaction: t
        }
      );

      res.send(
        `称号 *${title}* を手に入れたよ！ 称号数は *${newTitlesStr.length}個* 、全称号は *${newTitlesStr}* 、残り *${newMeritum}めりたん* になったよ。`
      );

      // 既に持っている称号の場合は、5分の1の確率でめりたんbotに引き取られる
      if (account.titles.includes(title)) {
        if (Math.random() > 0.8) {
          let botSlackId = (robot.adapter as SlackBot).self.id;
          let botAccount = await Account.findByPk(botSlackId, {
            transaction: t
          });

          if (!botAccount) {
            await t.commit();
            return;
          }

          let newBotTitles = botAccount.titles.split('');
          newBotTitles.push(title);
          newBotTitles = Array.from(new Set(newBotTitles)).sort();
          const newBotTitlesStr = newBotTitles.join('');
          await Account.update(
            {
              titles: newBotTitlesStr,
              numOfTitles: newBotTitlesStr.length
            },
            {
              where: {
                slackId: botSlackId
              },
              transaction: t
            }
          );

          res.send(
            `称号 *${title}* はもうあるみたいだから、めりたんbotがもらっちゃうね。 めりたんbotの称号数は *${newBotTitlesStr.length}個* 、全称号は *${newBotTitlesStr}* 、 *${botAccount.meritum}めりたん* になったよ。`
          );
        } else {
          res.send(
            `称号 *${title}* はもうあるみたいだね、残念。またチャレンジしてね。`
          );
        }
      }

      await t.commit();
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
      let account = await Account.findByPk(slackId, { transaction: t });
      if (!account) {
        // アカウントがない場合作る
        await Account.create(
          {
            slackId,
            name,
            realName,
            displayName,
            meritum: USER_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          },
          { transaction: t }
        );
        account = await Account.findByPk(slackId, { transaction: t });
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!account) {
        res.send('アカウントを作成することができないみたい。');
        console.log('アカウントを作成することができないみたい。');
        await t.commit();
        return;
      }

      const accounts = await Account.findAll({
        order: [
          ['numOfTitles', 'DESC'],
          ['meritum', 'DESC']
        ],
        attributes: ['slackId'],
        transaction: t
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
        `<@${slackId}>ちゃんの順位は *第${rank}位* 、 称号数は *${account.numOfTitles}個* 、全称号は *${titlesWithAlt}* 、めりたん数は *${account.meritum}めりたん* だよ。`
      );
    } catch (e) {
      console.log('Error on mself> e:');
      console.log(e);
      await t.rollback();
    }
  });

  // 自分のデータ表示 (Slackbot対応のため行頭でなくても許可)
  robot.hear(/mranking>$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slack = user.slack as Slack;

    const t = await database.transaction();
    try {
      const accounts = await Account.findAll({
        order: [
          ['numOfTitles', 'DESC'],
          ['meritum', 'DESC']
        ],
        limit: 100,
        transaction: t
      });
      await t.commit();

      let message = ':crown: *〜めりたん称号ランキング〜* :crown:\n';
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
          '\n:tada:めりたんbotをランキングから排除し、ユーザーたちが勝利しました！:tada:';
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
      res.send('rawTextが正しく取得できていないみたい。');
      return;
    }

    const parsed = rawText.match(/^mrank&gt; <@(.+)>.*/);
    if (!parsed) {
      res.send('コマンドの形式が `mrank> (@ユーザー名)` になってないね。');
      return;
    }

    const slackId = parsed[1];

    const t = await database.transaction();
    try {
      let account = await Account.findByPk(slackId, { transaction: t });
      if (!account) {
        res.send('このユーザーはプロジェクトmeritumをやってないみたい。');
        await t.commit();
        return;
      }

      const accounts = await Account.findAll({
        order: [
          ['numOfTitles', 'DESC'],
          ['meritum', 'DESC']
        ],
        attributes: ['slackId'],
        transaction: t
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
        `<@${slackId}>ちゃんの順位は *第${rank}位* 、 称号数は *${account.numOfTitles}個* 、全称号は *${titlesWithAlt}* 、めりたん数は *${account.meritum}めりたん* だよ。`
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
      res.send('rawTextが正しく取得でいないみたい。');
      return;
    }

    const parsed = rawText.match(/^msend&gt; <@(.+)> (\d+)/);
    if (!parsed) {
      res.send(
        'コマンドの形式が `msend> (@ユーザー名) (数値)` ではないみたい。'
      );
      return;
    }

    const toSlackId = parsed[1];
    const sendMeritum = parseInt(parsed[2]);

    if (sendMeritum <= 0) {
      res.send('0以下のめりたんを送ることはできないよ。');
      return;
    }

    const t = await database.transaction();
    try {
      let toAccount = await Account.findByPk(toSlackId, { transaction: t });
      if (!toAccount) {
        res.send('指定したユーザーはプロジェクトmeritumをやってないみたい。');
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
        res.send('自身へはめりたんを送ることはできないよ。');
        await t.commit();
        return;
      }

      let fromAccount = await Account.findByPk(fromSlackId, { transaction: t });

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
        }),
          { transaction: t };
        fromAccount = await Account.findByPk(fromSlackId, { transaction: t });
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!fromAccount) {
        res.send('アカウントを作成することができないみたい。');
        console.log('アカウントを作成することができないみたい。');
        await t.commit();
        return;
      }

      if (fromAccount.meritum < sendMeritum) {
        // 送るめりたんを持っていない場合、終了
        res.send(
          `<@${fromSlackId}>は、送るための *${sendMeritum}めりたん* をもってないみたいだよ。`
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
          },
          transaction: t
        }
      );
      await Account.update(
        { meritum: toAccount.meritum + sendMeritum },
        {
          where: {
            slackId: toSlackId
          },
          transaction: t
        }
      );

      await t.commit();

      res.send(
        `<@${fromSlackId}>から<@${toSlackId}>に *${sendMeritum}めりたん* を送って、<@${fromSlackId}>は *${fromAccount.meritum -
        sendMeritum}めりたん* に、 <@${toSlackId}>は *${toAccount.meritum +
        sendMeritum}めりたん* になったよ。`
      );
    } catch (e) {
      console.log('Error on msend> e:');
      console.log(e);
      await t.rollback();
    }
  });

  // 運命のおみくじ
  robot.hear(/^mmikuji>$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slackId = user.id;
    const name = user.name;
    const realName = user.real_name;
    const slack = user.slack as Slack;
    const displayName = slack.profile.display_name;
    const slackBot = robot.adapter as SlackBot;

    const MAX_WIN = 20;

    const t = await database.transaction();
    try {
      const receiptDate = getReceiptToday();
      const countOmikuji = await Omikuji.count({
        where: {
          slackId: slackId,
          receiptDate: {
            [Op.eq]: moment(receiptDate).format()
          }
        },
        transaction: t
      });

      if (countOmikuji === 1) {
        // 占い済み
        await t.commit();
        res.send(`<@${slackId}>ちゃんは、既に今日の運勢を占ったよ。`);
      } else {
        // ボット自身に最低でも20めりたんあるかチェック
        let botAccount = await Account.findByPk(slackBot.self.id, {
          transaction: t
        });
        if (!botAccount) {
          // ボットアカウントがない場合作る
          await Account.create(
            {
              slackId: slackBot.self.id,
              name: slackBot.self.name,
              realName: '',
              displayName: '',
              meritum: BOT_INITIAL_MERITUM,
              titles: '',
              numOfTitles: 0
            },
            { transaction: t }
          );
          botAccount = await Account.findByPk(slackBot.self.id, {
            transaction: t
          });
        } else if (botAccount.meritum < MAX_WIN) {
          // 最大景品分持っていない場合、終了
          res.send(
            `<@${slackBot.self.id}>はおみくじを用意できなかったみたい。`
          );
          await t.commit();
          return;
        }

        // ボットアカウントがない場合に作成してもまだないなら終了
        if (!botAccount) {
          res.send('ボットアカウントを作成することができなかったみたい。');
          console.log('ボットアカウントを作成することができなかったみたい。');
          await t.commit();
          return;
        }

        // 相手がおみくじできるかチェック
        let account = await Account.findByPk(slackId, { transaction: t });
        if (!account) {
          // アカウントがない場合作る
          const meritum = 0;
          await Account.create(
            {
              slackId,
              name,
              realName,
              displayName,
              meritum: USER_INITIAL_MERITUM,
              titles: '',
              numOfTitles: 0
            },
            { transaction: t }
          );
          account = await Account.findByPk(slackId, { transaction: t });
        } else if (account.meritum < OMIKUJI_MERITUM) {
          // おみくじ代分持っていない場合、終了
          res.send(
            `<@${slackId}>ちゃんは *${OMIKUJI_MERITUM}めりたん* ないからおみくじ引けないよ。`
          );
          await t.commit();
          return;
        }

        // アカウントがない場合に作成してもまだないなら終了
        if (!account) {
          res.send('アカウントを作成することができなかったみたい。');
          console.log('アカウントを作成することができなかったみたい。');
          await t.commit();
          return;
        }

        const prizes = [
          '大吉',
          '吉',
          '吉',
          '中吉',
          '中吉',
          '中吉',
          '小吉',
          '小吉',
          '小吉',
          '小吉',
          '末吉',
          '末吉',
          '末吉',
          '末吉',
          '末吉',
          '凶',
          '凶',
          '凶',
          '凶',
          '大凶'
        ];
        const prize = prizes[Math.floor(Math.random() * prizes.length)];

        function getPrizeMeritum(prize: String) {
          let result = 0;
          switch (prize) {
            case '大吉':
              result = 20;
              break;
            case '吉':
              result = 15;
              break;
            case '中吉':
              result = 10;
              break;
            case '小吉':
              result = 7;
              break;
            case '末吉':
              result = 4;
              break;
            case '凶':
              result = 1;
              break;
            case '大凶':
              result = 0;
              break;
            default:
              result = 0;
              break;
          }
          return result;
        }

        // 景品
        const prizeMeritum = getPrizeMeritum(prize);
        // 支払い処理
        const newMeritum = account.meritum - OMIKUJI_MERITUM + prizeMeritum;
        await Account.update(
          {
            meritum: newMeritum
          },
          {
            where: {
              slackId: slackId
            },
            transaction: t
          }
        );

        // おみくじ実績を作成
        await Omikuji.create(
          {
            slackId,
            receiptDate
          },
          { transaction: t }
        );

        await t.commit();

        if (prizeMeritum === 0) {
          res.send(
            `<@${slackId}>ちゃんの今日の運勢は... *${prize}* だよ！ 景品はないみたい。`
          );
        } else {
          res.send(
            `<@${slackId}>ちゃんの今日の運勢は... *${prize}* だよ！ 景品に *${prizeMeritum}めりたん* あげるね。`
          );
        }
      }
    } catch (e) {
      console.log('Error on mmikuji> e:');
      console.log(e);
      await t.rollback();
    }
  });
};
