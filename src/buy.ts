// Description:
//   ガチャを回して称号を取得

import { Robot, Response } from 'hubot';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';

import { Slack, SlackBot, MRobot } from './types/meritum';
import {
  USER_INITIAL_MERITUM,
  BOT_INITIAL_MERITUM,
  BUY_TITLE_PRICE,
  TITLES
} from './constants';

// DB同期
(async () => {
  await Account.sync();
})();

module.exports = (robot: MRobot<any>) => {
  // ガチャ
  robot.hear(/^mbuy> ([A-Z])$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slackId = user.id;
    const name = user.name;
    const realName = user.real_name;
    const slack = user.slack as Slack;
    const displayName = slack.profile.display_name;
    const slackBot = robot.adapter as SlackBot;

    const title = res.match[1];

    const t = await database.transaction();
    try {
      // ボット自身称号があるかチェック
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
      } else if (!botAccount.titles.includes(title)) {
        // ベット分持っていない場合、終了
        res.send(`<@${slackBot.self.id}>は 称号 *${title}* をもっていないよ。`);
        await t.commit();
        return;
      }

      // 相手が強制買い取りできるかチェック
      let account = await Account.findByPk(slackId, { transaction: t });
      if (!account) {
        // アカウントがない場合作る
        await Account.create(
          {
            slackId,
            name,
            realName,
            displayName,
            meritum: USER_INITIAL_MERITUM,
            titles: '',
            numOfTitles: 0
          },
          { transaction: t }
        );
        account = await Account.findByPk(slackId, { transaction: t });
      } else if (account.titles.includes(title)) {
        // すでに持っていれば終了
        res.send(
          `<@${slackId}>ちゃんは、称号  *${title}* をすでに持ってるから買い取れないよ。`
        );
        await t.commit();
        return;
      } else if (account.meritum < BUY_TITLE_PRICE) {
        // 強制買い取り費用を持っていない場合、終了
        res.send(
          `<@${slackId}>ちゃんは、買い取り費用の *${BUY_TITLE_PRICE}めりたん* がないから称号  *${title}* を買い取れないよ。`
        );
        await t.commit();
        return;
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!account || !botAccount) {
        res.send('アカウントを作成することができないみたい。');
        console.log('アカウントを作成することができないみたい。');
        await t.commit();
        return;
      }

      let newTitles = account.titles.split('');
      newTitles.push(title);
      newTitles = Array.from(new Set(newTitles)).sort();
      const newTitlesStr = newTitles.join('');

      // 支払い処理と称号追加
      const newMeritum = account.meritum - BUY_TITLE_PRICE;
      await Account.update(
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
        `<@${slackBot.self.id}>から 称号 *${title}* を *${BUY_TITLE_PRICE}めりたん* で買い取ったよ。 <@${slackId}>ちゃんの称号数は *${newTitlesStr.length}個* 、全称号は *${newTitlesStr}* 、残り *${newMeritum}めりたん* になったよ。`
      );

      // ボットからの称号削除処理
      let newBotTitles = botAccount.titles.split('');
      newBotTitles = newBotTitles.filter(t => t !== title);
      newBotTitles = Array.from(new Set(newBotTitles)).sort();
      const newBotTitlesStr = newBotTitles.join('');
      await Account.update(
        {
          meritum: botAccount.meritum + BUY_TITLE_PRICE,
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
          BUY_TITLE_PRICE}めりたん* になったよ。`
      );

      // クリアイベント
      let botSlackId = (robot.adapter as SlackBot).self.id;
      if (newTitlesStr.length === TITLES.length && slackId !== botSlackId) {
        res.send(
          `<@${slackId}>ちゃん、おめでとう！ これですべての称号を手に入れたよ！ <@${slackId}>ちゃんは *めりたん王* となりました！ ここまで遊んでくれて本当にありがとう！！！\n*:tada::tada::tada:GAME CLEAR:tada::tada::tada:*`
        );
      }

      await t.commit();
    } catch (e) {
      console.log('Error on mbuy> e:');
      console.log(e);
      await t.rollback();
    }
  });
};
