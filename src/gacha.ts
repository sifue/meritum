// Description:
//   ガチャを回して称号を取得

import { Robot, Response } from 'hubot';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';

import { Slack, SlackBot, MRobot } from './types/meritum';
import { GACHA_MERITUM, USER_INITIAL_MERITUM } from './constants';

// DB同期
(async () => {
  await Account.sync();
})();

module.exports = (robot: MRobot<any>) => {
  // ガチャ
  robot.hear(/^mgacha>$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slackId = user.id;
    const name = user.name;
    const realName = user.real_name;
    const slack = user.slack as Slack;
    const displayName = slack.profile.display_name;

    const t = await database.transaction();
    try {
      // 相手がガチャできるかチェック
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
      } else if (account.meritum < GACHA_MERITUM) {
        // ガチャ費用を持っていない場合、終了
        res.send(
          `<@${slackId}>ちゃんは、ガチャ費用の *${GACHA_MERITUM}めりたん* がないからガチャできないよ。`
        );
        await t.commit();
        return;
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!account) {
        res.send('アカウントを作成することができないみたい。');
        console.log('アカウントを作成することができないみたい。');
        await t.commit();
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
      const newMeritum = account.meritum - GACHA_MERITUM;
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
        `称号 *${title}* を手に入れたよ！ 称号数は *${newTitlesStr.length}個* 、全称号は *${newTitlesStr}* 、残り *${newMeritum}めりたん* になったよ。`
      );

      // 既に持っている称号の場合は、5分の1の確率でめりたんbotに引き取られる
      if (account.titles.includes(title)) {
        if (Math.random() > 0.8) {
          let botSlackId = (robot.adapter as SlackBot).self.id;
          let botAccount = await Account.findByPk(botSlackId, {
            transaction: t
          });

          if (!botAccount) {
            await t.commit();
            return;
          }

          let newBotTitles = botAccount.titles.split('');
          newBotTitles.push(title);
          newBotTitles = Array.from(new Set(newBotTitles)).sort();
          const newBotTitlesStr = newBotTitles.join('');
          await Account.update(
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

      await t.commit();
    } catch (e) {
      console.log('Error on mgacha> e:');
      console.log(e);
      await t.rollback();
    }
  });
};
