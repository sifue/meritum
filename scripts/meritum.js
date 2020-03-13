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
var __importDefault =
  (this && this.__importDefault) ||
  function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const hubot_1 = require('hubot');
const sequelize_1 = require('sequelize');
const moment_1 = __importDefault(require('moment'));
const sequelizeLoader_1 = require('./models/sequelizeLoader');
const accounts_1 = require('./models/accounts');
const loginBonuses_1 = require('./models/loginBonuses');
const omikuji_1 = require('./models/omikuji');
const LOGIN_BONUS_MERITUN = 100; // ログインボーナス
const BOT_INITIAL_MERITUM = 20000; // ボットの初期めりたん
const MAX_JANKEN_BET = 20; // 最大ベット
const GACHA_MERITUM = 280; // ガチャ費用
const OMIKUJI_MERITUM = 10; // おみくじ費用
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
    yield omikuji_1.Omikuji.sync();
  }))();
module.exports = robot => {
  // ヘルプ表示
  robot.hear(/^mhelp>$/i, res => {
    res.send(
      '*プロジェクトmeritum* とは、 *めりたん* と *称号* を集めるプロジェクト。' +
        '毎日のログインボーナスを集めて、ガチャを回し、称号を集めよう。' +
        '他人に迷惑をかける行為はしないでね。 *めりたん* が消滅します！' +
        'めりたんbotをランキング101位以下にしたらユーザーたちの勝利です。\n' +
        ':point_down::point_down::point_down::point_down: *〜コマンド説明〜* :point_down::point_down::point_down::point_down:\n' +
        '`mhelp>` : めりたんbotの使い方を表示。\n' +
        '`mlogin>` : ログインボーナスの *100めりたん* をゲット。毎朝7時にリセット。\n' +
        `\`mjanken> (グー|チョキ|パー) (1-${MAX_JANKEN_BET})\` : めりたんbotとめりたんを賭けてジャンケン。\n` +
        `\`mgacha>\` : *${GACHA_MERITUM}めりたん* でガチャを回し、称号をゲット。\n` +
        `\`mmikuji>\` : *${OMIKUJI_MERITUM}めりたん* でおみくじを引き、今日の運勢を占って景品をもらおう。\n` +
        '`mself>` : 自分の順位、称号数、全称号、めりたんを表示。\n' +
        '`mranking>` : 称号数で決まるランキングを表示(同称号数なら、めりたんの数順)。\n' +
        '`mrank> (@ユーザー名)` : 指定したユーザーの順位、称号数、全称号、めりたんを表示。\n' +
        '`msend> (@ユーザー名) (数値)` : 指定したユーザーに数値で指定しためりたんを送る。'
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
              [sequelize_1.Op.eq]: moment_1.default(receiptDate).format()
            }
          },
          transaction: t
        });
        if (countLoginBonus === 1) {
          // 取得済み
          yield t.commit();
          res.send(
            `<@${slackId}>ちゃんは、既に今日のログインボーナスをゲット済みだよ。`
          );
        } else {
          // 付与へ
          // アカウントがない場合には作り、100めりたん付与、ログインボーナス実績を追加
          const oldAccount = yield accounts_1.Account.findByPk(slackId, {
            transaction: t
          });
          let meritum = 0;
          if (!oldAccount) {
            meritum = LOGIN_BONUS_MERITUN + USER_INITIAL_MERITUM;
            yield accounts_1.Account.create(
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
            yield accounts_1.Account.update(
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
          yield loginBonuses_1.LoginBonus.create({
            slackId,
            receiptDate
          }),
            { transaction: t };
          yield t.commit();
          res.send(
            `<@${slackId}>ちゃんに、ログインボーナスとして *${LOGIN_BONUS_MERITUN}めりたん* をプレゼント。これで *${meritum}めりたん* になったよ。`
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
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        // ボット自身に最低でも10めりたんあるかチェック
        let botAccount = yield accounts_1.Account.findByPk(slackBot.self.id, {
          transaction: t
        });
        if (!botAccount) {
          // ボットアカウントがない場合作る
          yield accounts_1.Account.create(
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
          botAccount = yield accounts_1.Account.findByPk(slackBot.self.id, {
            transaction: t
          });
        } else if (botAccount.meritum < bet) {
          // ベット分持っていない場合、終了
          res.send(
            `<@${slackBot.self.id}>は *${bet}めりたん* をもっていないよ。`
          );
          yield t.commit();
          return;
        }
        // ボットアカウントがない場合に作成してもまだないなら終了
        if (!botAccount) {
          res.send('ボットアカウントを作成することができなかったみたい。');
          console.log('ボットアカウントを作成することができなかったみたい。');
          yield t.commit();
          return;
        }
        // 相手がベットできるかチェック
        let account = yield accounts_1.Account.findByPk(slackId, {
          transaction: t
        });
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
          }),
            { transaction: t };
          account = yield accounts_1.Account.findByPk(slackId, {
            transaction: t
          });
        } else if (account.meritum < bet) {
          // ベット分持っていない場合、終了
          res.send(
            `<@${slackId}>ちゃんは *${bet}めりたん* がないからジャンケンできないよ。`
          );
          yield t.commit();
          return;
        }
        // アカウントがない場合に作成してもまだないなら終了
        if (!account) {
          res.send('アカウントを作成することができなかったみたい。');
          console.log('アカウントを作成することができなかったみたい。');
          yield t.commit();
          return;
        }
        const botHands = ['グー', 'チョキ', 'パー'];
        const botHand = botHands[Math.floor(Math.random() * botHands.length)];
        if (botHand === hand) {
          res.send(
            `ジャンケン！ ${botHand}！... *あいこ* だね。またチャレンジしてね。`
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
              },
              transaction: t
            }
          );
          yield accounts_1.Account.update(
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
          yield accounts_1.Account.update(
            { meritum: account.meritum + bet },
            {
              where: {
                slackId: slackId
              },
              transaction: t
            }
          );
          yield accounts_1.Account.update(
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
        let account = yield accounts_1.Account.findByPk(slackId, {
          transaction: t
        });
        if (!account) {
          // アカウントがない場合作る
          yield accounts_1.Account.create(
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
          account = yield accounts_1.Account.findByPk(slackId, {
            transaction: t
          });
        } else if (account.meritum < GACHA_MERITUM) {
          // ガチャ費用を持っていない場合、終了
          res.send(
            `<@${slackId}>ちゃんは、ガチャ費用の *${GACHA_MERITUM}めりたん* がないからガチャできないよ。`
          );
          yield t.commit();
          return;
        }
        // アカウントがない場合に作成してもまだないなら終了
        if (!account) {
          res.send('アカウントを作成することができないみたい。');
          console.log('アカウントを作成することができないみたい。');
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
        yield accounts_1.Account.update(
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
            let botSlackId = robot.adapter.self.id;
            let botAccount = yield accounts_1.Account.findByPk(botSlackId, {
              transaction: t
            });
            if (!botAccount) {
              yield t.commit();
              return;
            }
            let newBotTitles = botAccount.titles.split('');
            newBotTitles.push(title);
            newBotTitles = Array.from(new Set(newBotTitles)).sort();
            const newBotTitlesStr = newBotTitles.join('');
            yield accounts_1.Account.update(
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
        yield t.commit();
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
        let account = yield accounts_1.Account.findByPk(slackId, {
          transaction: t
        });
        if (!account) {
          // アカウントがない場合作る
          yield accounts_1.Account.create(
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
          account = yield accounts_1.Account.findByPk(slackId, {
            transaction: t
          });
        }
        // アカウントがない場合に作成してもまだないなら終了
        if (!account) {
          res.send('アカウントを作成することができないみたい。');
          console.log('アカウントを作成することができないみたい。');
          yield t.commit();
          return;
        }
        const accounts = yield accounts_1.Account.findAll({
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
        yield t.commit();
        const titlesWithAlt = account.titles || 'なし';
        res.send(
          `<@${slackId}>ちゃんの順位は *第${rank}位* 、 称号数は *${account.numOfTitles}個* 、全称号は *${titlesWithAlt}* 、めりたん数は *${account.meritum}めりたん* だよ。`
        );
      } catch (e) {
        console.log('Error on mself> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
  // 自分のデータ表示 (Slackbot対応のため行頭でなくても許可)
  robot.hear(/mranking>$/i, res =>
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
          limit: 100,
          transaction: t
        });
        yield t.commit();
        let message = ':crown: *〜めりたん称号ランキング〜* :crown:\n';
        let botSlackId = robot.adapter.self.id;
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
        yield t.rollback();
      }
    })
  );
  // 他人のデータ表示
  robot.hear(/^mrank> (.+)/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      const rawText = res.message.rawText;
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
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        let account = yield accounts_1.Account.findByPk(slackId, {
          transaction: t
        });
        if (!account) {
          res.send('このユーザーはプロジェクトmeritumをやってないみたい。');
          yield t.commit();
          return;
        }
        const accounts = yield accounts_1.Account.findAll({
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
        yield t.commit();
        const titlesWithAlt = account.titles || 'なし';
        res.send(
          `<@${slackId}>ちゃんの順位は *第${rank}位* 、 称号数は *${account.numOfTitles}個* 、全称号は *${titlesWithAlt}* 、めりたん数は *${account.meritum}めりたん* だよ。`
        );
      } catch (e) {
        console.log('Error on mrank> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
  // 他人にめりたんを送る
  robot.hear(/^msend> (.+) (\d+)/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      const rawText = res.message.rawText;
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
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        let toAccount = yield accounts_1.Account.findByPk(toSlackId, {
          transaction: t
        });
        if (!toAccount) {
          res.send('指定したユーザーはプロジェクトmeritumをやってないみたい。');
          yield t.commit();
          return;
        }
        const fromUser = res.message.user;
        const fromSlackId = fromUser.id;
        const name = fromUser.name;
        const realName = fromUser.real_name;
        const slack = fromUser.slack;
        const displayName = slack.profile.display_name;
        if (fromSlackId === toSlackId) {
          res.send('自身へはめりたんを送ることはできないよ。');
          yield t.commit();
          return;
        }
        let fromAccount = yield accounts_1.Account.findByPk(fromSlackId, {
          transaction: t
        });
        if (!fromAccount) {
          // アカウントがない場合作る
          yield accounts_1.Account.create({
            fromSlackId,
            name,
            realName,
            displayName,
            meritum: USER_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          }),
            { transaction: t };
          fromAccount = yield accounts_1.Account.findByPk(fromSlackId, {
            transaction: t
          });
        }
        // アカウントがない場合に作成してもまだないなら終了
        if (!fromAccount) {
          res.send('アカウントを作成することができないみたい。');
          console.log('アカウントを作成することができないみたい。');
          yield t.commit();
          return;
        }
        if (fromAccount.meritum < sendMeritum) {
          // 送るめりたんを持っていない場合、終了
          res.send(
            `<@${fromSlackId}>は、送るための *${sendMeritum}めりたん* をもってないみたいだよ。`
          );
          yield t.commit();
          return;
        }
        // 送付処理
        yield accounts_1.Account.update(
          { meritum: fromAccount.meritum - sendMeritum },
          {
            where: {
              slackId: fromSlackId
            },
            transaction: t
          }
        );
        yield accounts_1.Account.update(
          { meritum: toAccount.meritum + sendMeritum },
          {
            where: {
              slackId: toSlackId
            },
            transaction: t
          }
        );
        yield t.commit();
        res.send(
          `<@${fromSlackId}>から<@${toSlackId}>に *${sendMeritum}めりたん* を送って、<@${fromSlackId}>は *${fromAccount.meritum -
            sendMeritum}めりたん* に、 <@${toSlackId}>は *${toAccount.meritum +
            sendMeritum}めりたん* になったよ。`
        );
      } catch (e) {
        console.log('Error on msend> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
  // 運命のおみくじ
  robot.hear(/^mmikuji>$/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      const user = res.message.user;
      const slackId = user.id;
      const name = user.name;
      const realName = user.real_name;
      const slack = user.slack;
      const displayName = slack.profile.display_name;
      const slackBot = robot.adapter;
      const MAX_WIN = 20;
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        const receiptDate = getReceiptToday();
        const countOmikuji = yield omikuji_1.Omikuji.count({
          where: {
            slackId: slackId,
            receiptDate: {
              [sequelize_1.Op.eq]: moment_1.default(receiptDate).format()
            }
          },
          transaction: t
        });
        if (countOmikuji === 1) {
          // 占い済み
          yield t.commit();
          res.send(`<@${slackId}>ちゃんは、既に今日の運勢を占ったよ。`);
        } else {
          // ボット自身に最低でも20めりたんあるかチェック
          let botAccount = yield accounts_1.Account.findByPk(slackBot.self.id, {
            transaction: t
          });
          if (!botAccount) {
            // ボットアカウントがない場合作る
            yield accounts_1.Account.create(
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
            botAccount = yield accounts_1.Account.findByPk(slackBot.self.id, {
              transaction: t
            });
          } else if (botAccount.meritum < MAX_WIN) {
            // 最大景品分持っていない場合、終了
            res.send(
              `<@${slackBot.self.id}>はおみくじを用意できなかったみたい。`
            );
            yield t.commit();
            return;
          }
          // ボットアカウントがない場合に作成してもまだないなら終了
          if (!botAccount) {
            res.send('ボットアカウントを作成することができなかったみたい。');
            console.log('ボットアカウントを作成することができなかったみたい。');
            yield t.commit();
            return;
          }
          // 相手がおみくじできるかチェック
          let account = yield accounts_1.Account.findByPk(slackId, {
            transaction: t
          });
          if (!account) {
            // アカウントがない場合作る
            const meritum = 0;
            yield accounts_1.Account.create(
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
            account = yield accounts_1.Account.findByPk(slackId, {
              transaction: t
            });
          } else if (account.meritum < OMIKUJI_MERITUM) {
            // おみくじ代分持っていない場合、終了
            res.send(
              `<@${slackId}>ちゃんは *${OMIKUJI_MERITUM}めりたん* ないからおみくじ引けないよ。`
            );
            yield t.commit();
            return;
          }
          // アカウントがない場合に作成してもまだないなら終了
          if (!account) {
            res.send('アカウントを作成することができなかったみたい。');
            console.log('アカウントを作成することができなかったみたい。');
            yield t.commit();
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
          function getPrizeMeritum(prize) {
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
          yield accounts_1.Account.update(
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
          yield omikuji_1.Omikuji.create(
            {
              slackId,
              receiptDate
            },
            { transaction: t }
          );
          yield t.commit();
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
        yield t.rollback();
      }
    })
  );
};
