// Description:
//   毎日ログインボーナスでもらった「めりたん」というポイントを使って遊ぶSlack用チャットボットゲーム

import { Robot, Response } from 'hubot';

import { Account } from './models/accounts';
import { LoginBonus } from './models/loginBonuses';

// DB同期
(async () => {
  await Account.sync();
  await LoginBonus.sync();
})();

interface ResponseEnv<R> extends Response<R> {
  envelope: {
    room: string;
  };
}

module.exports = (robot: Robot<any>) => {
  // 使い方
  robot.hear(/^mhelp>$/i, (msg: Response<Robot<any>>) => {
    msg.send('hello!');
  });
};
