// Description:
//   自身の順位を表示

import { Robot, Response } from 'hubot';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';

import { Slack, MRobot } from './types/meritum';
import { USER_INITIAL_MERITUM } from './constants';

// DB同期
(async () => {
  await Account.sync();
})();

module.exports = (robot: MRobot<any>) => {
  // 自分のデータ表示
  robot.hear(/^mself>$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slackId = user.id;
    const name = user.name;
    const realName = user.real_name;
    const slack = user.slack as Slack;
    const displayName = slack.profile.display_name;

    const t = await database.transaction();
    try {
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
      }

      // アカウントがない場合に作成してもまだないなら終了
      if (!account) {
        res.send('アカウントを作成することができないみたい。');
        console.log('アカウントを作成することができないみたい。');
        await t.commit();
        return;
      }

      const accounts = await Account.findAll({
        order: [
          ['numOfTitles', 'DESC'],
          ['meritum', 'DESC']
        ],
        attributes: ['slackId'],
        transaction: t
      });

      let rank = 1;
      for (const a of accounts) {
        if (a.slackId === slackId) {
          break;
        } else {
          rank++;
        }
      }

      await t.commit();
      const titlesWithAlt = account.titles || 'なし';
      res.send(
        `<@${slackId}>ちゃんの順位は *第${rank}位* 、 称号数は *${account.numOfTitles}個* 、全称号は *${titlesWithAlt}* 、めりたん数は *${account.meritum}めりたん* だよ。`
      );
    } catch (e) {
      console.log('Error on mself> e:');
      console.log(e);
      await t.rollback();
    }
  });
};
