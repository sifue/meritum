// Description:
//   指定した相手の順位を表示

import { Robot, Response, Message } from 'hubot';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';

import { MRobot } from './types/meritum';
class MessageWithRawText extends Message {
  rawText?: string;
}

// DB同期
(async () => {
  await Account.sync();
})();

module.exports = (robot: MRobot<any>) => {
  // 他人のデータ表示
  robot.hear(/^mrank> (.+)/i, async (res: Response<Robot<any>>) => {
    const rawText = (res.message as MessageWithRawText).rawText;
    if (!rawText) {
      res.send('rawTextが正しく取得できていないみたい。');
      return;
    }

    const parsed = rawText.match(/^mrank&gt; <@(.+)>.*/);
    if (!parsed) {
      res.send('コマンドの形式が `mrank> (@ユーザー名)` になってないね。');
      return;
    }

    const slackId = parsed[1];

    const t = await database.transaction();
    try {
      let account = await Account.findByPk(slackId, { transaction: t });
      if (!account) {
        res.send('このユーザーはプロジェクトmeritumをやってないみたい。');
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
      console.log('Error on mrank> e:');
      console.log(e);
      await t.rollback();
    }
  });
};
