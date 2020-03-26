'use strict';
// Description:
//   ランキングを表示
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
const sequelizeLoader_1 = require('./models/sequelizeLoader');
const accounts_1 = require('./models/accounts');
// DB同期
(() =>
  __awaiter(void 0, void 0, void 0, function*() {
    yield accounts_1.Account.sync();
  }))();
module.exports = robot => {
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
};
