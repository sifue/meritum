'use strict';
// Description:
//   相手にめりたんを送付
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
            meritum: constants_1.USER_INITIAL_MERITUM,
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
};
