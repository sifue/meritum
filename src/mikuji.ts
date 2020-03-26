// Description:
//   おみくじをひく

import { Robot, Response, Message } from 'hubot';
import { Op } from 'sequelize';
import moment from 'moment';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';
import { Omikuji } from './models/omikuji';

import { Slack, SlackBot, MRobot } from './types/meritum';
import {
  BOT_INITIAL_MERITUM,
  OMIKUJI_MERITUM,
  USER_INITIAL_MERITUM
} from './constants';

/**
 * ログインボーナス受領日を取得する、午前7時に変わるため、7時間前の時刻を返す
 * @returns {Date} 7時間前の時刻
 */
function getReceiptToday(): Date {
  return new Date(Date.now() - 1000 * 60 * 60 * 7);
}

// DB同期
(async () => {
  await Account.sync();
  await Omikuji.sync();
})();

module.exports = (robot: MRobot<any>) => {
  // 運命のおみくじ
  robot.hear(/^mmikuji>$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slackId = user.id;
    const name = user.name;
    const realName = user.real_name;
    const slack = user.slack as Slack;
    const displayName = slack.profile.display_name;
    const slackBot = robot.adapter as SlackBot;

    const MAX_WIN = 20;

    const t = await database.transaction();
    try {
      const receiptDate = getReceiptToday();
      const countOmikuji = await Omikuji.count({
        where: {
          slackId: slackId,
          receiptDate: {
            [Op.eq]: moment(receiptDate).format()
          }
        },
        transaction: t
      });

      if (countOmikuji === 1) {
        // 占い済み
        await t.commit();
        res.send(`<@${slackId}>ちゃんは、既に今日の運勢を占ったよ。`);
      } else {
        // ボット自身に最低でも20めりたんあるかチェック
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
        } else if (botAccount.meritum < MAX_WIN) {
          // 最大景品分持っていない場合、終了
          res.send(
            `<@${slackBot.self.id}>はおみくじを用意できなかったみたい。`
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

        // 相手がおみくじできるかチェック
        let account = await Account.findByPk(slackId, { transaction: t });
        if (!account) {
          // アカウントがない場合作る
          const meritum = 0;
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
        } else if (account.meritum < OMIKUJI_MERITUM) {
          // おみくじ代分持っていない場合、終了
          res.send(
            `<@${slackId}>ちゃんは *${OMIKUJI_MERITUM}めりたん* ないからおみくじ引けないよ。`
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

        const prizes = [
          '大吉',
          '吉',
          '吉',
          '中吉',
          '中吉',
          '中吉',
          '小吉',
          '小吉',
          '小吉',
          '小吉',
          '末吉',
          '末吉',
          '末吉',
          '末吉',
          '末吉',
          '凶',
          '凶',
          '凶',
          '凶',
          '大凶'
        ];
        const prize = prizes[Math.floor(Math.random() * prizes.length)];

        function getPrizeMeritum(prize: String) {
          let result = 0;
          switch (prize) {
            case '大吉':
              result = 20;
              break;
            case '吉':
              result = 15;
              break;
            case '中吉':
              result = 10;
              break;
            case '小吉':
              result = 7;
              break;
            case '末吉':
              result = 4;
              break;
            case '凶':
              result = 1;
              break;
            case '大凶':
              result = 0;
              break;
            default:
              result = 0;
              break;
          }
          return result;
        }

        // 景品
        const prizeMeritum = getPrizeMeritum(prize);
        // 支払い処理
        const newMeritum = account.meritum - OMIKUJI_MERITUM + prizeMeritum;
        await Account.update(
          {
            meritum: newMeritum
          },
          {
            where: {
              slackId: slackId
            },
            transaction: t
          }
        );

        // おみくじ実績を作成
        await Omikuji.create(
          {
            slackId,
            receiptDate
          },
          { transaction: t }
        );

        await t.commit();

        if (prizeMeritum === 0) {
          res.send(
            `<@${slackId}>ちゃんの今日の運勢は... *${prize}* だよ！ 景品はないみたい。`
          );
        } else {
          res.send(
            `<@${slackId}>ちゃんの今日の運勢は... *${prize}* だよ！ 景品に *${prizeMeritum}めりたん* あげるね。`
          );
        }
      }
    } catch (e) {
      console.log('Error on mmikuji> e:');
      console.log(e);
      await t.rollback();
    }
  });
};
