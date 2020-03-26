'use strict';
// Description:
//   ログインボーナスを取得
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
const loginBonuses_1 = require('./models/loginBonuses');
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
    yield loginBonuses_1.LoginBonus.sync();
  }))();
module.exports = robot => {
  // ログインボーナス
  robot.hear(/^mlogin>$/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      const user = res.message.user;
      const slackId = user.id;
      const name = user.name;
      const realName = user.real_name;
      const slack = user.slack;
      const displayName = slack.profile.display_name;
      let isBegginersLuck = false;
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
            isBegginersLuck = true;
            meritum =
              constants_1.LOGIN_BONUS_MERITUN *
                constants_1.BEGGINERS_LUCK_FACTOR +
              constants_1.USER_INITIAL_MERITUM;
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
            // 100 - 称号数 * 称号数 がビギナーズラックが起こるパーセンテージ
            let beginnersLuckPercentage =
              100 - oldAccount.numOfTitles * oldAccount.numOfTitles;
            if (beginnersLuckPercentage < 0) beginnersLuckPercentage = 0;
            isBegginersLuck = Math.random() < beginnersLuckPercentage / 100;
            // 称号数が少ない人にはビギナーズラックでログインボーナスBEGGINERS_LUCK_FACTOR倍に
            if (isBegginersLuck) {
              meritum =
                oldAccount.meritum +
                constants_1.LOGIN_BONUS_MERITUN *
                  constants_1.BEGGINERS_LUCK_FACTOR;
            } else {
              meritum = oldAccount.meritum + constants_1.LOGIN_BONUS_MERITUN;
            }
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
          if (isBegginersLuck) {
            res.send(
              `<@${slackId}>ちゃんに、ログインボーナスとして *${constants_1.LOGIN_BONUS_MERITUN *
                constants_1.BEGGINERS_LUCK_FACTOR}めりたん* をプレゼント。これで *${meritum}めりたん* になったよ。今回はビギナーズラックでボーナス${
                constants_1.BEGGINERS_LUCK_FACTOR
              }倍になったよ！`
            );
          } else {
            res.send(
              `<@${slackId}>ちゃんに、ログインボーナスとして *${constants_1.LOGIN_BONUS_MERITUN}めりたん* をプレゼント。これで *${meritum}めりたん* になったよ。`
            );
          }
        }
      } catch (e) {
        console.log('Error on mlogin> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
};
