'use strict';
// Description:
//   ガチャを回して称号を取得
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
const constants_1 = require('./constants');
// DB同期
(() =>
  __awaiter(void 0, void 0, void 0, function*() {
    yield accounts_1.Account.sync();
  }))();
module.exports = robot => {
  // ガチャ
  robot.hear(/^mbuy> ([A-Z])$/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      const user = res.message.user;
      const slackId = user.id;
      const name = user.name;
      const realName = user.real_name;
      const slack = user.slack;
      const displayName = slack.profile.display_name;
      const slackBot = robot.adapter;
      const title = res.match[1];
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        // ボット自身称号があるかチェック
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
        } else if (!botAccount.titles.includes(title)) {
          // ベット分持っていない場合、終了
          res.send(
            `<@${slackBot.self.id}>は 称号 *${title}* をもっていないよ。`
          );
          yield t.commit();
          return;
        }
        // 相手が強制買い取りできるかチェック
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
              meritum: constants_1.USER_INITIAL_MERITUM,
              titles: '',
              numOfTitles: 0
            },
            { transaction: t }
          );
          account = yield accounts_1.Account.findByPk(slackId, {
            transaction: t
          });
        } else if (account.titles.includes(title)) {
          // すでに持っていれば終了
          res.send(
            `<@${slackId}>ちゃんは、称号  *${title}* をすでに持ってるから買い取れないよ。`
          );
          yield t.commit();
          return;
        } else if (account.meritum < constants_1.BUY_TITLE_PRICE) {
          // 強制買い取り費用を持っていない場合、終了
          res.send(
            `<@${slackId}>ちゃんは、買い取り費用の *${constants_1.BUY_TITLE_PRICE}めりたん* がないから称号  *${title}* を買い取れないよ。`
          );
          yield t.commit();
          return;
        }
        // アカウントがない場合に作成してもまだないなら終了
        if (!account || !botAccount) {
          res.send('アカウントを作成することができないみたい。');
          console.log('アカウントを作成することができないみたい。');
          yield t.commit();
          return;
        }
        let newTitles = account.titles.split('');
        newTitles.push(title);
        newTitles = Array.from(new Set(newTitles)).sort();
        const newTitlesStr = newTitles.join('');
        // 支払い処理と称号追加
        const newMeritum = account.meritum - constants_1.BUY_TITLE_PRICE;
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
          `<@${slackBot.self.id}>から 称号 *${title}* を *${constants_1.BUY_TITLE_PRICE}めりたん* で買い取ったよ。 <@${slackId}>ちゃんの称号数は *${newTitlesStr.length}個* 、全称号は *${newTitlesStr}* 、残り *${newMeritum}めりたん* になったよ。`
        );
        // ボットからの称号削除処理
        let newBotTitles = botAccount.titles.split('');
        newBotTitles = newBotTitles.filter(t => t !== title);
        newBotTitles = Array.from(new Set(newBotTitles)).sort();
        const newBotTitlesStr = newBotTitles.join('');
        yield accounts_1.Account.update(
          {
            meritum: botAccount.meritum + constants_1.BUY_TITLE_PRICE,
            titles: newBotTitlesStr,
            numOfTitles: newBotTitlesStr.length
          },
          {
            where: {
              slackId: slackBot.self.id
            },
            transaction: t
          }
        );
        res.send(
          `称号を買い取られた<@${slackBot.self.id}>の称号数は *${
            newBotTitlesStr.length
          }個* 、全称号は *${newBotTitlesStr}* 、 *${botAccount.meritum +
            constants_1.BUY_TITLE_PRICE}めりたん* になったよ。`
        );
        yield t.commit();
      } catch (e) {
        console.log('Error on mbuy> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
};
