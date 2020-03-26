'use strict';
// Description:
//   ユーザー同士でめりたんを賭けてじゃんけんをする
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
const web_api_1 = require('@slack/web-api');
const sequelizeLoader_1 = require('./models/sequelizeLoader');
const accounts_1 = require('./models/accounts');
const constants_1 = require('./constants');
const web = new web_api_1.WebClient(process.env.HUBOT_SLACK_TOKEN);
// DB同期
(() =>
  __awaiter(void 0, void 0, void 0, function*() {
    yield accounts_1.Account.sync();
  }))();
module.exports = robot => {
  // キーはユーザーのDMのルームIDとなっているセッションのMap
  const mapUserJankenSession = new Map();
  // 他のユーザーとめりたんを賭けてジャンケン
  robot.hear(/^muj> (.+) (\d+)/i, res =>
    __awaiter(void 0, void 0, void 0, function*() {
      var _a;
      const rawText = res.message.rawText;
      if (!rawText) {
        res.send('rawTextが正しく取得でいないみたい。');
        return;
      }
      const parsed = rawText.match(/^muj&gt; <@(.+)> (\d+)/);
      if (!parsed) {
        res.send(
          'コマンドの形式が `muj> (@ユーザー名) (数値)` ではないみたい。'
        );
        return;
      }
      const opponentSlackId = parsed[1];
      const sendMeritum = parseInt(parsed[2]);
      if (sendMeritum <= 0) {
        res.send('0以下のめりたんをかけてジャンケンはできないよ。');
        return;
      }
      if (sendMeritum > constants_1.MAX_USER_JANKEN_BET) {
        res.send(
          `*${constants_1.MAX_USER_JANKEN_BET}めりたん* より多くをかけてジャンケンすることは禁止されているよ。`
        );
        return;
      }
      const t = yield sequelizeLoader_1.database.transaction();
      try {
        let opponentAccount = yield accounts_1.Account.findByPk(
          opponentSlackId,
          {
            transaction: t
          }
        );
        if (!opponentAccount) {
          res.send('指定したユーザーはプロジェクトmeritumをやってないみたい。');
          yield t.commit();
          return;
        }
        if (opponentAccount.meritum < sendMeritum) {
          // 賭けるめりたんを持っていない場合、終了
          res.send(
            `<@${opponentSlackId}>は、賭けるための *${sendMeritum}めりたん* をもってないみたいだよ。`
          );
          yield t.commit();
          return;
        }
        const myUser = res.message.user;
        const mySlackId = myUser.id;
        const name = myUser.name;
        const realName = myUser.real_name;
        const slack = myUser.slack;
        const displayName = slack.profile.display_name;
        // XXX: デバッグ時は自身とのジャンケンを可能にするとデバッグが楽、その際はこのブロックをコメントアウト
        if (mySlackId === opponentSlackId) {
          res.send('自身とはじゃんけんできないよ。');
          yield t.commit();
          return;
        }
        let myAccount = yield accounts_1.Account.findByPk(mySlackId, {
          transaction: t
        });
        if (!myAccount) {
          // アカウントがない場合作る
          yield accounts_1.Account.create({
            slackId: mySlackId,
            name,
            realName,
            displayName,
            meritum: constants_1.USER_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          }),
            { transaction: t };
          myAccount = yield accounts_1.Account.findByPk(mySlackId, {
            transaction: t
          });
        }
        // アカウントがない場合に作成してもまだないなら終了
        if (!myAccount) {
          res.send('ユーザーが作成できなかったみたい。');
          yield t.commit();
          return;
        }
        if (myAccount.meritum < sendMeritum) {
          // 送るめりたんを持っていない場合、終了
          res.send(
            `<@${mySlackId}>は、賭けるための *${sendMeritum}めりたん* をもってないみたいだよ。`
          );
          yield t.commit();
          return;
        }
        // DMでジャンケンの招待を送る
        const chatPostMessageResponse = yield web.chat.postMessage({
          channel: opponentSlackId,
          text: `<@${mySlackId}>ちゃんから  *${sendMeritum}めりたん* を賭けたジャンケンに招待されたよ。60秒以内に手を選択しない場合には勝負はキャンセルになるよ。`,
          as_user: true
        });
        const channel = chatPostMessageResponse.channel;
        const timestamp =
          (_a = chatPostMessageResponse.message) === null || _a === void 0
            ? void 0
            : _a.ts;
        if (!channel || !timestamp) {
          res.send('ジャンケンの招待ができなかったみたい。');
          yield t.commit();
          return;
        }
        yield web.reactions.add({ channel, name: 'fist', timestamp });
        yield web.reactions.add({ channel, name: 'v', timestamp });
        yield web.reactions.add({
          channel,
          name: 'raised_hand_with_fingers_splayed',
          timestamp
        });
        yield web.reactions.add({ channel, name: 'x', timestamp });
        // セションを作成
        const session = {
          status: 'offering',
          startChannel: res.message.room,
          opponentChannel: channel,
          opponentTimestamp: timestamp,
          me: mySlackId,
          opponent: opponentSlackId,
          offeredTime: Date.now(),
          sendMeritum
        };
        mapUserJankenSession.set(channel, session);
        yield t.commit();
        res.send(
          `<@${mySlackId}>ちゃんから<@${opponentSlackId}>ちゃんへ *${sendMeritum}めりたん* を賭けたジャンケンの招待を送ったよ。`
        );
        // 60 秒後に敵の手が決まってないままだったらキャンセル
        setTimeout(
          () =>
            __awaiter(void 0, void 0, void 0, function*() {
              if (session.status === 'offering') {
                mapUserJankenSession.delete(channel);
                yield web.chat.postMessage({
                  channel: session.startChannel,
                  text: `<@${opponentSlackId}>ちゃんは、${constants_1.LIMIT_TIME_SEC_USER_JANKEN}秒で手を決められなかったので勝負はキャンセルになったよ。`,
                  as_user: true
                });
              }
            }),
          constants_1.LIMIT_TIME_SEC_USER_JANKEN * 1000
        );
      } catch (e) {
        console.log('Error on muj> e:');
        console.log(e);
        yield t.rollback();
      }
    })
  );
  // ジャンケンの結果の受け取り
  robot.hearReaction(res =>
    __awaiter(void 0, void 0, void 0, function*() {
      var _b;
      const message = res.message;
      const session = mapUserJankenSession.get(message.room);
      if (message.type === 'added' && message.reaction === 'x' && session) {
        mapUserJankenSession.delete(message.room);
        const cancellerSlackId = res.message.user.id;
        yield web.chat.postMessage({
          channel: session.startChannel,
          text: `<@${cancellerSlackId}>ちゃんが相手とのジャンケンをキャンセルしたみたい。`,
          as_user: true
        });
        session.status = 'finished';
        return;
      }
      if (
        message.type === 'added' &&
        session &&
        (message.reaction === 'fist' ||
          message.reaction === 'v' ||
          message.reaction === 'raised_hand_with_fingers_splayed')
      ) {
        if (session.status === 'offering') {
          // 敵の手が決まって送られてくる場合
          mapUserJankenSession.delete(message.room);
          const opponentSlackId = res.message.user.id;
          const opponentHand = message.reaction;
          session.opponentHand = message.reaction;
          yield web.chat.postMessage({
            channel: session.opponentChannel,
            text: `<@${opponentSlackId}>ちゃんの手は :${opponentHand}: になりました。 <@${session.me}>ちゃんの手を待ちます。`,
            as_user: true
          });
          const chatPostMessageResponse = yield web.chat.postMessage({
            channel: session.me,
            text: `<@${opponentSlackId}>ちゃんとの  *${session.sendMeritum}めりたん* を賭けたジャンケンをするよ。${constants_1.LIMIT_TIME_SEC_USER_JANKEN}秒以内に手を選択しない場合には勝負はキャンセルになるよ。`,
            as_user: true
          });
          const channel = chatPostMessageResponse.channel;
          const timestamp =
            (_b = chatPostMessageResponse.message) === null || _b === void 0
              ? void 0
              : _b.ts;
          if (!channel || !timestamp) {
            return;
          }
          yield web.reactions.add({ channel, name: 'fist', timestamp });
          yield web.reactions.add({ channel, name: 'v', timestamp });
          yield web.reactions.add({
            channel,
            name: 'raised_hand_with_fingers_splayed',
            timestamp
          });
          yield web.reactions.add({ channel, name: 'x', timestamp });
          session.status = 'opponent_ready';
          mapUserJankenSession.set(channel, session);
          // 60 秒後に自身の手が決まってないままだったらキャンセル
          setTimeout(
            () =>
              __awaiter(void 0, void 0, void 0, function*() {
                if (session.status === 'opponent_ready') {
                  mapUserJankenSession.delete(channel);
                  yield web.chat.postMessage({
                    channel: session.startChannel,
                    text: `<@${session.me}>ちゃんは、${constants_1.LIMIT_TIME_SEC_USER_JANKEN}秒で手を決められなかったので勝負はキャンセルになったよ。`,
                    as_user: true
                  });
                }
              }),
            constants_1.LIMIT_TIME_SEC_USER_JANKEN * 1000
          );
        } else if (session.status === 'opponent_ready') {
          // 自身の手が決まって送らてくる場合
          mapUserJankenSession.delete(message.room);
          const mySlackId = res.message.user.id;
          const myHand = message.reaction;
          // 流れ的には、敵が先に手を決めているけども、手はわからないので自身でこのメッセージを表示させ手を確認する
          yield web.chat.postMessage({
            channel: session.me,
            text: `<@${mySlackId}>ちゃんの手は :${myHand}: になりました。 <@${session.opponent}>ちゃんの手を待ちます。`,
            as_user: true
          });
          const t = yield sequelizeLoader_1.database.transaction();
          try {
            let myAccount = yield accounts_1.Account.findByPk(mySlackId, {
              transaction: t
            });
            // 自分に賭けに必要なめりたんがあるかチェック
            if (!myAccount || myAccount.meritum < session.sendMeritum) {
              yield web.chat.postMessage({
                channel: session.startChannel,
                text: `<@${
                  myAccount === null || myAccount === void 0
                    ? void 0
                    : myAccount.slackId
                }>ちゃんはには *${
                  session.sendMeritum
                }めりたん* なかったみたい。`,
                as_user: true
              });
              yield t.commit();
              return;
            }
            // 相手に賭けに必要なめりたんがあるかチェック
            let opponentAccount = yield accounts_1.Account.findByPk(
              session.opponent,
              {
                transaction: t
              }
            );
            if (
              !opponentAccount ||
              opponentAccount.meritum < session.sendMeritum
            ) {
              yield web.chat.postMessage({
                channel: session.startChannel,
                text: `<@${
                  opponentAccount === null || opponentAccount === void 0
                    ? void 0
                    : opponentAccount.slackId
                }>ちゃんはには *${
                  session.sendMeritum
                }めりたん* なかったみたい。`,
                as_user: true
              });
              yield t.commit();
              return;
            }
            if (myHand === session.opponentHand) {
              yield web.chat.postMessage({
                channel: session.startChannel,
                text: `<@${mySlackId}>ちゃんは :${myHand}: 、<@${session.opponent}>ちゃんは :${session.opponentHand}: で、あいこだったよ。また勝負してね。`,
                as_user: true
              });
              yield t.commit();
              session.status = 'finished';
              return;
            }
            const isMyWin =
              (myHand === 'fist' && session.opponentHand === 'v') ||
              (myHand === 'v' &&
                session.opponentHand === 'raised_hand_with_fingers_splayed') ||
              (myHand === 'raised_hand_with_fingers_splayed' &&
                session.opponentHand === 'fist');
            if (isMyWin) {
              // 勝ち処理
              yield accounts_1.Account.update(
                { meritum: opponentAccount.meritum - session.sendMeritum },
                {
                  where: {
                    slackId: session.opponent
                  },
                  transaction: t
                }
              );
              yield accounts_1.Account.update(
                { meritum: myAccount.meritum + session.sendMeritum },
                {
                  where: {
                    slackId: mySlackId
                  },
                  transaction: t
                }
              );
              yield web.chat.postMessage({
                channel: session.startChannel,
                text: `<@${mySlackId}>ちゃんは :${myHand}: 、<@${
                  session.opponent
                }>ちゃんは :${
                  session.opponentHand
                }: で<@${mySlackId}>ちゃんの勝ち。<@${mySlackId}>ちゃんは *${myAccount.meritum +
                  session.sendMeritum}めりたん* に 、<@${
                  session.opponent
                }>ちゃんは *${opponentAccount.meritum -
                  session.sendMeritum}めりたん* になったよ。`,
                as_user: true
              });
            } else {
              // 負け処理
              yield accounts_1.Account.update(
                { meritum: opponentAccount.meritum + session.sendMeritum },
                {
                  where: {
                    slackId: session.opponent
                  },
                  transaction: t
                }
              );
              yield accounts_1.Account.update(
                { meritum: myAccount.meritum - session.sendMeritum },
                {
                  where: {
                    slackId: mySlackId
                  },
                  transaction: t
                }
              );
              yield web.chat.postMessage({
                channel: session.startChannel,
                text: `<@${mySlackId}>ちゃんは :${myHand}: 、<@${
                  session.opponent
                }>ちゃんは :${session.opponentHand}: で<@${
                  session.opponent
                }>ちゃんの勝ち。<@${mySlackId}>ちゃんは *${myAccount.meritum -
                  session.sendMeritum}めりたん* に 、<@${
                  session.opponent
                }>ちゃんは *${opponentAccount.meritum +
                  session.sendMeritum}めりたん* になったよ。`,
                as_user: true
              });
            }
            yield t.commit();
            session.status = 'finished';
          } catch (e) {
            console.log('Error on muj> e:');
            console.log(e);
            yield t.rollback();
          }
        }
      }
    })
  );
};
