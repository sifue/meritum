'use strict';
// Description:
//   毎日ログインボーナスでもらった「めりたん」というポイントを使って遊ぶSlack用チャットボットゲーム
var __awaiter =
  (this && this.__awaiter) ||
  function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function(resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, '__esModule', { value: true });
const hubot_1 = require('hubot');
const sequelize_1 = require('sequelize');
const sequelizeLoader_1 = require('./models/sequelizeLoader');
const accounts_1 = require('./models/accounts');
const loginBonuses_1 = require('./models/loginBonuses');
const LOGIN_BONUS_MERITUN = 100; // ログインボーナス
const BOT_INITIAL_MERITUM = 20000; // ボットの初期めりたん
const MAX_JANKEN_BET = 20; // 最大ベット
const GACHA_MERITUM = 280; // ガチャ費用
const USER_INITIAL_MERITUM = GACHA_MERITUM + MAX_JANKEN_BET; // ユーザーの初期めりたん
/**
 * ログインボーナス受領日を取得する、午前7時に変わるため、7時間前の時刻を返す
 * @returns {Date} 7時間前の時刻
 */
function getReceiptToday() {
  return new Date(Date.now() - 1000 * 60 * 60 * 7);
}
class MessageWithRawText extends hubot_1.Message {}
// DB同期
(() =>
  __awaiter(void 0, void 0, void 0, function*() {
    yield accounts_1.Account.sync();
    yield loginBonuses_1.LoginBonus.sync();
  }))();
module.exports = robot => {
  // ヘルプ表示
  robot.hear(/^mhelp>$/i, res => {
    res.send(
      'プロジェクトmeritumとは、めりたんと称号を集めるプロジェクト。' +
        '毎日のログインボーナスを集めて、ガチャを回し、称号を集めよう！' +
        '他人に迷惑をかけたりしないように！めりたんが消滅します！' +
        'めりたんbotをランキング100以下にしたら勝利！\n' +
        '■コマンド説明\n' +
        '`mhelp>` : めりたんbotの使い方を表示。\n' +
        '`mlogin>` : ログインボーナスの *100めりたん* をゲット。毎朝7時にリセット。\n' +
        `\`mjanken> (グー|チョキ|パー) (1-${MAX_JANKEN_BET})\` : めりたんbotとめりたんを賭けてジャンケン。\n` +
        `\`mgacha>\` : *${GACHA_MERITUM}めりたん* でガチャを回して称号をゲット。\n` +
        '`mself>` : 自分のめりたん、称号数、全称号、順位を表示。\n' +
        '`mranking>` : 称号数、次にめりたんで決まるランキングを表示。\n' +
        '`mrank> (@ユーザー名)` : 指定したユーザーのめりたん、称号数、全称号、順位を表示。\n' +
        '`msend> (@ユーザー名) (数値)` : 指定したユーザーに数値で指定しためりたんを送る'
    );
  });
  // ログインボーナス
  robot.hear(/^mlogin>$/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      const user = res.message.user;
      const slackId = user.id;
      const name = user.name;
      const realName = user.real_name;
      const slack = user.slack;
      const displayName = slack.profile.display_name;
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        const receiptDate = getReceiptToday();
        const countLoginBonus = yield loginBonuses_1.LoginBonus.count({
          where: {
            slackId: slackId,
            receiptDate: {
              [sequelize_1.Op.eq]: receiptDate
            }
          }
        });
        if (countLoginBonus === 1) {
          // 取得済み
          yield t.commit();
          res.send(
            `<@${slackId}>さんは、既に本日のログインボーナスを取得済みです。`
          );
        } else {
          // 付与へ
          // アカウントがない場合には作り、100めりたん付与、ログインボーナス実績を追加
          const oldAccount = yield accounts_1.Account.findByPk(slackId);
          let meritum = 0;
          if (!oldAccount) {
            meritum = LOGIN_BONUS_MERITUN;
            yield accounts_1.Account.create({
              slackId,
              name,
              realName,
              displayName,
              meritum: USER_INITIAL_MERITUM,
              titles: '',
              numOfTitles: 0
            });
          } else {
            meritum = oldAccount.meritum + LOGIN_BONUS_MERITUN;
            yield accounts_1.Account.update(
              { meritum },
              {
                where: {
                  slackId: slackId
                }
              }
            );
          }
          // ログインボーナス実績を作成
          yield loginBonuses_1.LoginBonus.create({
            slackId,
            receiptDate
          });
          yield t.commit();
          res.send(
            `<@${slackId}>さんにログインボーナスとして *${LOGIN_BONUS_MERITUN}めりたん* を付与し、 *${meritum}めりたん* となりました。`
          );
        }
      } catch (e) {
        console.log('Error on mlogin> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
  // ジャンケン
  robot.hear(/^mjanken> (グー|チョキ|パー) (\d+)$/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      const user = res.message.user;
      const slackId = user.id;
      const name = user.name;
      const realName = user.real_name;
      const slack = user.slack;
      const displayName = slack.profile.display_name;
      const slackBot = robot.adapter;
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
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        // ボット自身に最低でも10めりたんあるかチェック
        let botAccount = yield accounts_1.Account.findByPk(slackBot.self.id);
        if (!botAccount) {
          // ボットアカウントがない場合作る
          yield accounts_1.Account.create({
            slackId: slackBot.self.id,
            name: slackBot.self.name,
            realName: '',
            displayName: '',
            meritum: BOT_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          });
          botAccount = yield accounts_1.Account.findByPk(slackBot.self.id);
        } else if (botAccount.meritum < bet) {
          // ベット分持っていない場合、終了
          res.send(
            `<@${slackBot.self.id}>は *${bet}めりたん* を所有していないためジャンケンできません。`
          );
          yield t.commit();
          return;
        }
        // ボットアカウントがない場合に作成してもまだないなら終了
        if (!botAccount) {
          res.send('ボットアカウントを作成することができませんでした。');
          console.log('ボットアカウントを作成することができませんでした。');
          yield t.commit();
          return;
        }
        // 相手がベットできるかチェック
        let account = yield accounts_1.Account.findByPk(slackId);
        if (!account) {
          // アカウントがない場合作る
          const meritum = 0;
          yield accounts_1.Account.create({
            slackId,
            name,
            realName,
            displayName,
            meritum: USER_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          });
          account = yield accounts_1.Account.findByPk(slackId);
        } else if (account.meritum < bet) {
          // ベット分持っていない場合、終了
          res.send(
            `<@${slackId}>は *${bet}めりたん* を所有していないためジャンケンできません。`
          );
          yield t.commit();
          return;
        }
        // アカウントがない場合に作成してもまだないなら終了
        if (!account) {
          res.send('アカウントを作成することができませんでした。');
          console.log('アカウントを作成することができませんでした。');
          yield t.commit();
          return;
        }
        const botHands = ['グー', 'チョキ', 'パー'];
        const botHand = botHands[Math.floor(Math.random() * botHands.length)];
        if (botHand === hand) {
          res.send(
            `ジャンケン！ ${botHand}！... *あいこ* ですね。またの機会に。`
          );
          yield t.commit();
          return;
        }
        const isBotWon =
          (botHand === 'グー' && hand === 'チョキ') ||
          (botHand === 'チョキ' && hand === 'パー') ||
          (botHand === 'パー' && hand === 'グー');
        if (isBotWon) {
          // 負け処理
          yield accounts_1.Account.update(
            { meritum: account.meritum - bet },
            {
              where: {
                slackId: slackId
              }
            }
          );
          yield accounts_1.Account.update(
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
          yield accounts_1.Account.update(
            { meritum: account.meritum + bet },
            {
              where: {
                slackId: slackId
              }
            }
          );
          yield accounts_1.Account.update(
            { meritum: botAccount.meritum - bet },
            {
              where: {
                slackId: slackBot.self.id
              }
            }
          );
          res.send(
            `ジャンケン！ ${botHand}！...あなたの *勝ち* ですね。 *${bet}めりたん* お支払いします。これで *${account.meritum +
              bet}めりたん* になりました。`
          );
        }
        yield t.commit();
      } catch (e) {
        console.log('Error on mjanken> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
  // ガチャ
  robot.hear(/^mgacha>$/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      const user = res.message.user;
      const slackId = user.id;
      const name = user.name;
      const realName = user.real_name;
      const slack = user.slack;
      const displayName = slack.profile.display_name;
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        // 相手がガチャできるかチェック
        let account = yield accounts_1.Account.findByPk(slackId);
        if (!account) {
          // アカウントがない場合作る
          const meritum = 0;
          yield accounts_1.Account.create({
            slackId,
            name,
            realName,
            displayName,
            meritum: USER_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          });
          account = yield accounts_1.Account.findByPk(slackId);
        } else if (account.meritum < GACHA_MERITUM) {
          // ガチャ費用を持っていない場合、終了
          res.send(
            `<@${slackId}>は、ガチャ費用 *${GACHA_MERITUM}めりたん* を所有していないためガチャできません。`
          );
          yield t.commit();
          return;
        }
        // アカウントがない場合に作成してもまだないなら終了
        if (!account) {
          res.send('アカウントを作成することができませんでした。');
          console.log('アカウントを作成することができませんでした。');
          yield t.commit();
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
        yield accounts_1.Account.update(
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
        yield t.commit();
        res.send(
          `称号 *${title}* を手に入れました！ 称号数は *${newTitlesStr.length}個* 、全称号は *${newTitlesStr}* 、 所有めりたんは *${newMeritum}めりたん* となりました。`
        );
      } catch (e) {
        console.log('Error on mgacha> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
  // 自分のデータ表示
  robot.hear(/^mself>$/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      const user = res.message.user;
      const slackId = user.id;
      const name = user.name;
      const realName = user.real_name;
      const slack = user.slack;
      const displayName = slack.profile.display_name;
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        let account = yield accounts_1.Account.findByPk(slackId);
        if (!account) {
          // アカウントがない場合作る
          yield accounts_1.Account.create({
            slackId,
            name,
            realName,
            displayName,
            meritum: USER_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          });
          account = yield accounts_1.Account.findByPk(slackId);
        }
        // アカウントがない場合に作成してもまだないなら終了
        if (!account) {
          res.send('アカウントを作成することができませんでした。');
          console.log('アカウントを作成することができませんでした。');
          yield t.commit();
          return;
        }
        const accounts = yield accounts_1.Account.findAll({
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
        yield t.commit();
        const titlesWithAlt = account.titles || 'なし';
        res.send(
          `あなたの順位は *第${rank}位* 、 称号数は *${account.numOfTitles}個* 、全称号は *${titlesWithAlt}* 、 所有めりたんは *${account.meritum}めりたん* です。`
        );
      } catch (e) {
        console.log('Error on mself> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
  // 自分のデータ表示
  robot.hear(/^mranking>$/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      const user = res.message.user;
      const slack = user.slack;
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        const accounts = yield accounts_1.Account.findAll({
          order: [
            ['numOfTitles', 'DESC'],
            ['meritum', 'DESC']
          ],
          limit: 100
        });
        yield t.commit();
        let message = '■めりたん称号ランキング\n';
        let rank = 1;
        for (const a of accounts) {
          let rankName = a.displayName || a.realName;
          rankName = rankName || a.name;
          message += `*第${rank}位* ${rankName} (称号数: ${a.numOfTitles}、めりたん: ${a.meritum})\n`;
          rank++;
        }
        res.send(message);
      } catch (e) {
        console.log('Error on mranking> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
  // 他人のデータ表示
  robot.hear(/^mrank> (.+)/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      const rawText = res.message.rawText;
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
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        let account = yield accounts_1.Account.findByPk(slackId);
        if (!account) {
          res.send('指定したユーザーはプロジェクトmeritumをやっていません。');
          yield t.commit();
          return;
        }
        const accounts = yield accounts_1.Account.findAll({
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
        yield t.commit();
        const titlesWithAlt = account.titles || 'なし';
        res.send(
          `<@${slackId}>の順位は *第${rank}位* 、 称号数は *${account.numOfTitles}個* 、全称号は *${titlesWithAlt}* 、 所有めりたんは *${account.meritum}めりたん* です。`
        );
      } catch (e) {
        console.log('Error on mrank> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
};
