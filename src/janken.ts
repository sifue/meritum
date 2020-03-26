// Description:
//  めりたんbotとのジャンケン

import { Robot, Response, Message } from 'hubot';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';

import { Slack, SlackBot, MRobot } from './types/meritum';
import {
  BOT_INITIAL_MERITUM,
  MAX_JANKEN_BET,
  USER_INITIAL_MERITUM
} from './constants';

// DB同期
(async () => {
  await Account.sync();
})();

module.exports = (robot: MRobot<any>) => {
  // ジャンケン
  robot.hear(
    /^mjanken> (グー|チョキ|パー) (\d+)$/i,
    async (res: Response<Robot<any>>) => {
      const user = res.message.user;
      const slackId = user.id;
      const name = user.name;
      const realName = user.real_name;
      const slack = user.slack as Slack;
      const displayName = slack.profile.display_name;
      const slackBot = robot.adapter as SlackBot;

      const hand = res.match[1];
      const bet = parseInt(res.match[2]);

      if (bet > MAX_JANKEN_BET) {
        res.send(
          `*${MAX_JANKEN_BET}めりたん* より大きい数をかけてジャンケンすることは禁止されているよ。`
        );
        return;
      }

      if (bet <= 0) {
        res.send(
          '*1めりたん* より小さな数の *めりたん* をかけることはできないよ。'
        );
        return;
      }

      const t = await database.transaction();
      try {
        // ボット自身に最低でも10めりたんあるかチェック
        let botAccount = await Account.findByPk(slackBot.self.id, {
          transaction: t
        });
        if (!botAccount) {
          // ボットアカウントがない場合作る
          await Account.create(
            {
              slackId: slackBot.self.id,
              name: slackBot.self.name,
              realName: '',
              displayName: '',
              meritum: BOT_INITIAL_MERITUM,
              titles: '',
              numOfTitles: 0
            },
            { transaction: t }
          );
          botAccount = await Account.findByPk(slackBot.self.id, {
            transaction: t
          });
        } else if (botAccount.meritum < bet) {
          // ベット分持っていない場合、終了
          res.send(
            `<@${slackBot.self.id}>は *${bet}めりたん* をもっていないよ。`
          );
          await t.commit();
          return;
        }

        // ボットアカウントがない場合に作成してもまだないなら終了
        if (!botAccount) {
          res.send('ボットアカウントを作成することができなかったみたい。');
          console.log('ボットアカウントを作成することができなかったみたい。');
          await t.commit();
          return;
        }

        // 相手がベットできるかチェック
        let account = await Account.findByPk(slackId, { transaction: t });
        if (!account) {
          // アカウントがない場合作る
          const meritum = 0;
          await Account.create({
            slackId,
            name,
            realName,
            displayName,
            meritum: USER_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          }),
            { transaction: t };
          account = await Account.findByPk(slackId, { transaction: t });
        } else if (account.meritum < bet) {
          // ベット分持っていない場合、終了
          res.send(
            `<@${slackId}>ちゃんは *${bet}めりたん* がないからジャンケンできないよ。`
          );
          await t.commit();
          return;
        }

        // アカウントがない場合に作成してもまだないなら終了
        if (!account) {
          res.send('アカウントを作成することができなかったみたい。');
          console.log('アカウントを作成することができなかったみたい。');
          await t.commit();
          return;
        }

        const botHands = ['グー', 'チョキ', 'パー'];
        const botHand = botHands[Math.floor(Math.random() * botHands.length)];

        if (botHand === hand) {
          res.send(
            `ジャンケン！ ${botHand}！... *あいこ* だね。またチャレンジしてね。`
          );
          await t.commit();
          return;
        }

        const isBotWon =
          (botHand === 'グー' && hand === 'チョキ') ||
          (botHand === 'チョキ' && hand === 'パー') ||
          (botHand === 'パー' && hand === 'グー');

        if (isBotWon) {
          // 負け処理
          await Account.update(
            { meritum: account.meritum - bet },
            {
              where: {
                slackId: slackId
              },
              transaction: t
            }
          );
          await Account.update(
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
          await Account.update(
            { meritum: account.meritum + bet },
            {
              where: {
                slackId: slackId
              },
              transaction: t
            }
          );
          await Account.update(
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
        await t.commit();
      } catch (e) {
        console.log('Error on mjanken> e:');
        console.log(e);
        await t.rollback();
      }
    }
  );
};
