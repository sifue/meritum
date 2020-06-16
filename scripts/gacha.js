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
              meritum: constants_1.USER_INITIAL_MERITUM,
              titles: '',
              numOfTitles: 0
            },
            { transaction: t }
          );
          account = yield accounts_1.Account.findByPk(slackId, {
            transaction: t
          });
        } else if (account.meritum < constants_1.GACHA_MERITUM) {
          // ガチャ費用を持っていない場合、終了
          res.send(
            `<@${slackId}>ちゃんは、ガチャ費用の *${constants_1.GACHA_MERITUM}めりたん* がないからガチャできないよ。`
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
        const newMeritum = account.meritum - constants_1.GACHA_MERITUM;
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
        // クリアイベント
        let botSlackId = robot.adapter.self.id;
        if (newTitlesStr.length === titles.length && slackId !== botSlackId) {
          res.send(
            `<@${slackId}>ちゃん、おめでとう！ これですべての称号を手に入れたよ！ <@${slackId}>ちゃんは *めりたん王* となりました！ ここまで遊んでくれて本当にありがとう！！！\n*:tada::tada::tada:GAME CLEAR:tada::tada::tada:*`
          );
        }
        // 既に持っている称号の場合は、5分の1の確率でめりたんbotに引き取られる
        if (account.titles.includes(title)) {
          if (Math.random() > 0.8) {
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
};
