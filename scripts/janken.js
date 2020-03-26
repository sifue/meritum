'use strict';
// Description:
//  めりたんbotとのジャンケン
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
      if (bet > constants_1.MAX_JANKEN_BET) {
        res.send(
          `*${constants_1.MAX_JANKEN_BET}めりたん* より大きい数をかけてジャンケンすることは禁止されているよ。`
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
              meritum: constants_1.BOT_INITIAL_MERITUM,
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
            meritum: constants_1.USER_INITIAL_MERITUM,
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
};
