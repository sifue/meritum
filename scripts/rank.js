'use strict';
// Description:
//   指定した相手の順位を表示
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
const sequelizeLoader_1 = require('./models/sequelizeLoader');
const accounts_1 = require('./models/accounts');
class MessageWithRawText extends hubot_1.Message {}
// DB同期
(() =>
  __awaiter(void 0, void 0, void 0, function*() {
    yield accounts_1.Account.sync();
  }))();
module.exports = robot => {
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
};
