'use strict';
// Description:
//   おみくじをひく
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
const sequelize_1 = require('sequelize');
const moment_1 = __importDefault(require('moment'));
const sequelizeLoader_1 = require('./models/sequelizeLoader');
const accounts_1 = require('./models/accounts');
const omikuji_1 = require('./models/omikuji');
const constants_1 = require('./constants');
/**
 * ログインボーナス受領日を取得する、午前7時に変わるため、7時間前の時刻を返す
 * @returns {Date} 7時間前の時刻
 */
function getReceiptToday() {
  return new Date(Date.now() - 1000 * 60 * 60 * 7);
}
// DB同期
(() =>
  __awaiter(void 0, void 0, void 0, function*() {
    yield accounts_1.Account.sync();
    yield omikuji_1.Omikuji.sync();
  }))();
module.exports = robot => {
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
                meritum: constants_1.BOT_INITIAL_MERITUM,
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
                meritum: constants_1.USER_INITIAL_MERITUM,
                titles: '',
                numOfTitles: 0
              },
              { transaction: t }
            );
            account = yield accounts_1.Account.findByPk(slackId, {
              transaction: t
            });
          } else if (account.meritum < constants_1.OMIKUJI_MERITUM) {
            // おみくじ代分持っていない場合、終了
            res.send(
              `<@${slackId}>ちゃんは *${constants_1.OMIKUJI_MERITUM}めりたん* ないからおみくじ引けないよ。`
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
          const newMeritum =
            account.meritum - constants_1.OMIKUJI_MERITUM + prizeMeritum;
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
