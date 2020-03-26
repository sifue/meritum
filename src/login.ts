// Description:
//   ログインボーナスを取得

import { Robot, Response, Message } from 'hubot';
import { Op } from 'sequelize';
import moment from 'moment';

import { database } from './models/sequelizeLoader';

import { Account } from './models/accounts';
import { LoginBonus } from './models/loginBonuses';

import { Slack, MRobot } from './types/meritum';
import {
  LOGIN_BONUS_MERITUN,
  BEGGINERS_LUCK_FACTOR,
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
  await LoginBonus.sync();
})();

module.exports = (robot: MRobot<any>) => {
  // ログインボーナス
  robot.hear(/^mlogin>$/i, async (res: Response<Robot<any>>) => {
    const user = res.message.user;
    const slackId = user.id;
    const name = user.name;
    const realName = user.real_name;
    const slack = user.slack as Slack;
    const displayName = slack.profile.display_name;

    let isBegginersLuck = false;

    const t = await database.transaction();
    try {
      const receiptDate = getReceiptToday();
      const countLoginBonus = await LoginBonus.count({
        where: {
          slackId: slackId,
          receiptDate: {
            [Op.eq]: moment(receiptDate).format()
          }
        },
        transaction: t
      });

      if (countLoginBonus === 1) {
        // 取得済み
        await t.commit();
        res.send(
          `<@${slackId}>ちゃんは、既に今日のログインボーナスをゲット済みだよ。`
        );
      } else {
        // 付与へ
        // アカウントがない場合には作り、100めりたん付与、ログインボーナス実績を追加
        const oldAccount = await Account.findByPk(slackId, { transaction: t });
        let meritum = 0;
        if (!oldAccount) {
          isBegginersLuck = true;
          meritum =
            LOGIN_BONUS_MERITUN * BEGGINERS_LUCK_FACTOR + USER_INITIAL_MERITUM;
          await Account.create(
            {
              slackId,
              name,
              realName,
              displayName,
              meritum,
              titles: '',
              numOfTitles: 0
            },
            { transaction: t }
          );
        } else {
          // 100 - 称号数 * 称号数 がビギナーズラックが起こるパーセンテージ
          let beginnersLuckPercentage =
            100 - oldAccount.numOfTitles * oldAccount.numOfTitles;
          if (beginnersLuckPercentage < 0) beginnersLuckPercentage = 0;

          isBegginersLuck = Math.random() < beginnersLuckPercentage / 100;

          // 称号数が少ない人にはビギナーズラックでログインボーナスBEGGINERS_LUCK_FACTOR倍に
          if (isBegginersLuck) {
            meritum =
              oldAccount.meritum + LOGIN_BONUS_MERITUN * BEGGINERS_LUCK_FACTOR;
          } else {
            meritum = oldAccount.meritum + LOGIN_BONUS_MERITUN;
          }

          // ログインボーナス取得時にユーザー名などを更新
          await Account.update(
            {
              name,
              realName,
              displayName,
              meritum
            },
            {
              where: {
                slackId: slackId
              },
              transaction: t
            }
          );
        }

        // ログインボーナス実績を作成
        await LoginBonus.create({
          slackId,
          receiptDate
        }),
          { transaction: t };

        await t.commit();

        if (isBegginersLuck) {
          res.send(
            `<@${slackId}>ちゃんに、ログインボーナスとして *${LOGIN_BONUS_MERITUN *
              BEGGINERS_LUCK_FACTOR}めりたん* をプレゼント。これで *${meritum}めりたん* になったよ。今回はビギナーズラックでボーナス${BEGGINERS_LUCK_FACTOR}倍になったよ！`
          );
        } else {
          res.send(
            `<@${slackId}>ちゃんに、ログインボーナスとして *${LOGIN_BONUS_MERITUN}めりたん* をプレゼント。これで *${meritum}めりたん* になったよ。`
          );
        }
      }
    } catch (e) {
      console.log('Error on mlogin> e:');
      console.log(e);
      await t.rollback();
    }
  });
};
