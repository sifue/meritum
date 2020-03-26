// Description:
//   ユーザー同士でめりたんを賭けてじゃんけんをする

import { Robot, Response } from 'hubot';
import { WebClient } from '@slack/web-api';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';

import {
  Slack,
  UserJankenSession,
  MRobot,
  MessageWithRawText
} from './types/meritum';
import {
  MAX_USER_JANKEN_BET,
  LIMIT_TIME_SEC_USER_JANKEN,
  USER_INITIAL_MERITUM
} from './constants';

import { ChatPostMessageResponse } from 'seratch-slack-types/web-api';

const web = new WebClient(process.env.HUBOT_SLACK_TOKEN);

// DB同期
(async () => {
  await Account.sync();
})();

module.exports = (robot: MRobot<any>) => {
  // キーはユーザーのDMのルームIDとなっているセッションのMap
  const mapUserJankenSession = new Map<string, UserJankenSession>();

  // 他のユーザーとめりたんを賭けてジャンケン
  robot.hear(/^muj> (.+) (\d+)/i, async (res: Response<Robot<any>>) => {
    const rawText = (res.message as MessageWithRawText).rawText;
    if (!rawText) {
      res.send('rawTextが正しく取得でいないみたい。');
      return;
    }

    const parsed = rawText.match(/^muj&gt; <@(.+)> (\d+)/);
    if (!parsed) {
      res.send('コマンドの形式が `muj> (@ユーザー名) (数値)` ではないみたい。');
      return;
    }

    const opponentSlackId = parsed[1];
    const sendMeritum = parseInt(parsed[2]);

    if (sendMeritum <= 0) {
      res.send('0以下のめりたんをかけてジャンケンはできないよ。');
      return;
    }

    if (sendMeritum > MAX_USER_JANKEN_BET) {
      res.send(
        `*${MAX_USER_JANKEN_BET}めりたん* より多くをかけてジャンケンすることは禁止されているよ。`
      );
      return;
    }

    const t = await database.transaction();
    try {
      let opponentAccount = await Account.findByPk(opponentSlackId, {
        transaction: t
      });
      if (!opponentAccount) {
        res.send('指定したユーザーはプロジェクトmeritumをやってないみたい。');
        await t.commit();
        return;
      }

      if (opponentAccount.meritum < sendMeritum) {
        // 賭けるめりたんを持っていない場合、終了
        res.send(
          `<@${opponentSlackId}>は、賭けるための *${sendMeritum}めりたん* をもってないみたいだよ。`
        );
        await t.commit();
        return;
      }

      const myUser = res.message.user;
      const mySlackId = myUser.id;
      const name = myUser.name;
      const realName = myUser.real_name;
      const slack = myUser.slack as Slack;
      const displayName = slack.profile.display_name;

      // XXX: デバッグ時は自身とのジャンケンを可能にするとデバッグが楽、その際はこのブロックをコメントアウト
      if (mySlackId === opponentSlackId) {
        res.send('自身とはじゃんけんできないよ。');
        await t.commit();
        return;
      }

      let myAccount = await Account.findByPk(mySlackId, { transaction: t });

      if (!myAccount) {
        // アカウントがない場合作る
        await Account.create({
          slackId: mySlackId,
          name,
          realName,
          displayName,
          meritum: USER_INITIAL_MERITUM,
          titles: '',
          numOfTitles: 0
        }),
          { transaction: t };
        myAccount = await Account.findByPk(mySlackId, { transaction: t });
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!myAccount) {
        res.send('ユーザーが作成できなかったみたい。');
        await t.commit();
        return;
      }

      if (myAccount.meritum < sendMeritum) {
        // 送るめりたんを持っていない場合、終了
        res.send(
          `<@${mySlackId}>は、賭けるための *${sendMeritum}めりたん* をもってないみたいだよ。`
        );
        await t.commit();
        return;
      }

      // DMでジャンケンの招待を送る
      const chatPostMessageResponse = (await web.chat.postMessage({
        channel: opponentSlackId,
        text: `<@${mySlackId}>ちゃんから  *${sendMeritum}めりたん* を賭けたジャンケンに招待されたよ。60秒以内に手を選択しない場合には勝負はキャンセルになるよ。`,
        as_user: true
      })) as ChatPostMessageResponse;
      const channel = chatPostMessageResponse.channel;
      const timestamp = chatPostMessageResponse.message?.ts;

      if (!channel || !timestamp) {
        res.send('ジャンケンの招待ができなかったみたい。');
        await t.commit();
        return;
      }

      await web.reactions.add({ channel, name: 'fist', timestamp });
      await web.reactions.add({ channel, name: 'v', timestamp });
      await web.reactions.add({
        channel,
        name: 'raised_hand_with_fingers_splayed',
        timestamp
      });
      await web.reactions.add({ channel, name: 'x', timestamp });

      // セションを作成
      const session = {
        status: 'offering',
        startChannel: (res.message as any).room,
        opponentChannel: channel,
        opponentTimestamp: timestamp,
        me: mySlackId,
        opponent: opponentSlackId,
        offeredTime: Date.now(),
        sendMeritum
      } as UserJankenSession;
      mapUserJankenSession.set(channel, session);

      await t.commit();
      res.send(
        `<@${mySlackId}>ちゃんから<@${opponentSlackId}>ちゃんへ *${sendMeritum}めりたん* を賭けたジャンケンの招待を送ったよ。`
      );

      // 60 秒後に敵の手が決まってないままだったらキャンセル
      setTimeout(async () => {
        if (session.status === 'offering') {
          mapUserJankenSession.delete(channel);
          (await web.chat.postMessage({
            channel: session.startChannel,
            text: `<@${opponentSlackId}>ちゃんは、${LIMIT_TIME_SEC_USER_JANKEN}秒で手を決められなかったので勝負はキャンセルになったよ。`,
            as_user: true
          })) as ChatPostMessageResponse;
        }
      }, LIMIT_TIME_SEC_USER_JANKEN * 1000);
    } catch (e) {
      console.log('Error on muj> e:');
      console.log(e);
      await t.rollback();
    }
  });

  // ジャンケンの結果の受け取り
  robot.hearReaction(async (res: Response<Robot<any>>) => {
    const message = res.message as any;
    const session = mapUserJankenSession.get(message.room);

    if (message.type === 'added' && message.reaction === 'x' && session) {
      mapUserJankenSession.delete(message.room);
      const cancellerSlackId = res.message.user.id;
      (await web.chat.postMessage({
        channel: session.startChannel,
        text: `<@${cancellerSlackId}>ちゃんが相手とのジャンケンをキャンセルしたみたい。`,
        as_user: true
      })) as ChatPostMessageResponse;
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

        (await web.chat.postMessage({
          channel: session.opponentChannel,
          text: `<@${opponentSlackId}>ちゃんの手は :${opponentHand}: になりました。 <@${session.me}>ちゃんの手を待ちます。`,
          as_user: true
        })) as ChatPostMessageResponse;

        const chatPostMessageResponse = (await web.chat.postMessage({
          channel: session.me,
          text: `<@${opponentSlackId}>ちゃんとの  *${session.sendMeritum}めりたん* を賭けたジャンケンをするよ。${LIMIT_TIME_SEC_USER_JANKEN}秒以内に手を選択しない場合には勝負はキャンセルになるよ。`,
          as_user: true
        })) as ChatPostMessageResponse;
        const channel = chatPostMessageResponse.channel;
        const timestamp = chatPostMessageResponse.message?.ts;

        if (!channel || !timestamp) {
          return;
        }

        await web.reactions.add({ channel, name: 'fist', timestamp });
        await web.reactions.add({ channel, name: 'v', timestamp });
        await web.reactions.add({
          channel,
          name: 'raised_hand_with_fingers_splayed',
          timestamp
        });
        await web.reactions.add({ channel, name: 'x', timestamp });

        session.status = 'opponent_ready';
        mapUserJankenSession.set(channel, session);

        // 60 秒後に自身の手が決まってないままだったらキャンセル
        setTimeout(async () => {
          if (session.status === 'opponent_ready') {
            mapUserJankenSession.delete(channel);
            (await web.chat.postMessage({
              channel: session.startChannel,
              text: `<@${session.me}>ちゃんは、${LIMIT_TIME_SEC_USER_JANKEN}秒で手を決められなかったので勝負はキャンセルになったよ。`,
              as_user: true
            })) as ChatPostMessageResponse;
          }
        }, LIMIT_TIME_SEC_USER_JANKEN * 1000);
      } else if (session.status === 'opponent_ready') {
        // 自身の手が決まって送らてくる場合
        mapUserJankenSession.delete(message.room);

        const mySlackId = res.message.user.id;
        const myHand = message.reaction;

        // 流れ的には、敵が先に手を決めているけども、手はわからないので自身でこのメッセージを表示させ手を確認する
        (await web.chat.postMessage({
          channel: session.me,
          text: `<@${mySlackId}>ちゃんの手は :${myHand}: になりました。 <@${session.opponent}>ちゃんの手を待ちます。`,
          as_user: true
        })) as ChatPostMessageResponse;

        const t = await database.transaction();
        try {
          let myAccount = await Account.findByPk(mySlackId, {
            transaction: t
          });

          // 自分に賭けに必要なめりたんがあるかチェック
          if (!myAccount || myAccount.meritum < session.sendMeritum) {
            (await web.chat.postMessage({
              channel: session.startChannel,
              text: `<@${myAccount?.slackId}>ちゃんはには *${session.sendMeritum}めりたん* なかったみたい。`,
              as_user: true
            })) as ChatPostMessageResponse;
            await t.commit();
            return;
          }

          // 相手に賭けに必要なめりたんがあるかチェック
          let opponentAccount = await Account.findByPk(session.opponent, {
            transaction: t
          });
          if (
            !opponentAccount ||
            opponentAccount.meritum < session.sendMeritum
          ) {
            (await web.chat.postMessage({
              channel: session.startChannel,
              text: `<@${opponentAccount?.slackId}>ちゃんはには *${session.sendMeritum}めりたん* なかったみたい。`,
              as_user: true
            })) as ChatPostMessageResponse;
            await t.commit();
            return;
          }

          if (myHand === session.opponentHand) {
            (await web.chat.postMessage({
              channel: session.startChannel,
              text: `<@${mySlackId}>ちゃんは :${myHand}: 、<@${session.opponent}>ちゃんは :${session.opponentHand}: で、あいこだったよ。また勝負してね。`,
              as_user: true
            })) as ChatPostMessageResponse;
            await t.commit();
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
            await Account.update(
              { meritum: opponentAccount.meritum - session.sendMeritum },
              {
                where: {
                  slackId: session.opponent
                },
                transaction: t
              }
            );
            await Account.update(
              { meritum: myAccount.meritum + session.sendMeritum },
              {
                where: {
                  slackId: mySlackId
                },
                transaction: t
              }
            );

            (await web.chat.postMessage({
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
            })) as ChatPostMessageResponse;
          } else {
            // 負け処理
            await Account.update(
              { meritum: opponentAccount.meritum + session.sendMeritum },
              {
                where: {
                  slackId: session.opponent
                },
                transaction: t
              }
            );
            await Account.update(
              { meritum: myAccount.meritum - session.sendMeritum },
              {
                where: {
                  slackId: mySlackId
                },
                transaction: t
              }
            );

            (await web.chat.postMessage({
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
            })) as ChatPostMessageResponse;
          }
          await t.commit();
          session.status = 'finished';
        } catch (e) {
          console.log('Error on muj> e:');
          console.log(e);
          await t.rollback();
        }
      }
    }
  });
};
