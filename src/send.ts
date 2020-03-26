// Description:
//   相手にめりたんを送付

import { Robot, Response } from 'hubot';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';

import { Slack, MRobot, MessageWithRawText } from './types/meritum';
import { USER_INITIAL_MERITUM } from './constants';

// DB同期
(async () => {
  await Account.sync();
})();

module.exports = (robot: MRobot<any>) => {
  // 他人にめりたんを送る
  robot.hear(/^msend> (.+) (\d+)/i, async (res: Response<Robot<any>>) => {
    const rawText = (res.message as MessageWithRawText).rawText;
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

    const t = await database.transaction();
    try {
      let toAccount = await Account.findByPk(toSlackId, { transaction: t });
      if (!toAccount) {
        res.send('指定したユーザーはプロジェクトmeritumをやってないみたい。');
        await t.commit();
        return;
      }

      const fromUser = res.message.user;
      const fromSlackId = fromUser.id;
      const name = fromUser.name;
      const realName = fromUser.real_name;
      const slack = fromUser.slack as Slack;
      const displayName = slack.profile.display_name;

      if (fromSlackId === toSlackId) {
        res.send('自身へはめりたんを送ることはできないよ。');
        await t.commit();
        return;
      }

      let fromAccount = await Account.findByPk(fromSlackId, { transaction: t });

      if (!fromAccount) {
        // アカウントがない場合作る
        await Account.create({
          fromSlackId,
          name,
          realName,
          displayName,
          meritum: USER_INITIAL_MERITUM,
          titles: '',
          numOfTitles: 0
        }),
          { transaction: t };
        fromAccount = await Account.findByPk(fromSlackId, { transaction: t });
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!fromAccount) {
        res.send('アカウントを作成することができないみたい。');
        console.log('アカウントを作成することができないみたい。');
        await t.commit();
        return;
      }

      if (fromAccount.meritum < sendMeritum) {
        // 送るめりたんを持っていない場合、終了
        res.send(
          `<@${fromSlackId}>は、送るための *${sendMeritum}めりたん* をもってないみたいだよ。`
        );
        await t.commit();
        return;
      }

      // 送付処理
      await Account.update(
        { meritum: fromAccount.meritum - sendMeritum },
        {
          where: {
            slackId: fromSlackId
          },
          transaction: t
        }
      );
      await Account.update(
        { meritum: toAccount.meritum + sendMeritum },
        {
          where: {
            slackId: toSlackId
          },
          transaction: t
        }
      );

      await t.commit();

      res.send(
        `<@${fromSlackId}>から<@${toSlackId}>に *${sendMeritum}めりたん* を送って、<@${fromSlackId}>は *${fromAccount.meritum -
          sendMeritum}めりたん* に、 <@${toSlackId}>は *${toAccount.meritum +
          sendMeritum}めりたん* になったよ。`
      );
    } catch (e) {
      console.log('Error on msend> e:');
      console.log(e);
      await t.rollback();
    }
  });
};
