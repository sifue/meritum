// Description:
//   ランキングを表示

import { Robot, Response } from 'hubot';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';

import { Slack, SlackBot, MRobot } from './types/meritum';

// DB同期
(async () => {
  await Account.sync();
})();

module.exports = (robot: MRobot<any>) => {
  // 自分のデータ表示 (Slackbot対応のため行頭でなくても許可)
  robot.hear(/mranking>$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slack = user.slack as Slack;

    const t = await database.transaction();
    try {
      const accounts = await Account.findAll({
        order: [
          ['numOfTitles', 'DESC'],
          ['meritum', 'DESC']
        ],
        limit: 100,
        transaction: t
      });
      await t.commit();

      let message = ':crown: *〜めりたん称号ランキング〜* :crown:\n';
      let botSlackId = (robot.adapter as SlackBot).self.id;
      let isUserWon = true;
      let rank = 1;
      for (const a of accounts) {
        if (botSlackId === a.slackId) isUserWon = false;
        let rankName = a.displayName || a.realName;
        rankName = rankName || a.name;
        message += `*第${rank}位* ${rankName} (称号数: ${a.numOfTitles}、めりたん: ${a.meritum})\n`;
        rank++;
      }

      if (isUserWon) {
        message +=
          '\n:tada:めりたんbotをランキングから排除し、ユーザーたちが勝利しました！:tada:';
      }

      res.send(message);
    } catch (e) {
      console.log('Error on mranking> e:');
      console.log(e);
      await t.rollback();
    }
  });
};
