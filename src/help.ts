// Description:
//   ヘルプを表示

import { Robot, Response } from 'hubot';

import { MRobot } from './types/meritum';
import {
  LOGIN_BONUS_MERITUN,
  MAX_JANKEN_BET,
  MAX_USER_JANKEN_BET,
  GACHA_MERITUM,
  OMIKUJI_MERITUM,
  BUY_TITLE_PRICE
} from './constants';

module.exports = (robot: MRobot<any>) => {
  // ヘルプ表示
  robot.hear(/^mhelp>$/i, (res: Response<Robot<any>>) => {
    res.send(
      '*プロジェクトmeritum* とは、 *めりたん* と *称号* を集めるプロジェクト。' +
        '毎日のログインボーナスを集めて、ガチャを回し、称号を集めよう。' +
        '他人に迷惑をかける行為はしないでね。 *めりたん* が消滅します！' +
        'めりたんbotをランキング101位以下にしたらユーザーたちの勝利です。\n' +
        ':point_down::point_down::point_down::point_down: *〜コマンド説明〜* :point_down::point_down::point_down::point_down:\n' +
        '`mhelp>` : めりたんbotの使い方を表示。\n' +
        `\`mlogin>\` : ログインボーナスの *${LOGIN_BONUS_MERITUN}めりたん* をゲット。毎朝7時にリセット。\n` +
        `\`mjanken> (グー|チョキ|パー) (1-${MAX_JANKEN_BET})\` : めりたんbotとめりたんを賭けてジャンケン。\n` +
        `\`muj> (@ユーザー名) (1-${MAX_USER_JANKEN_BET})\` : 指定したユーザーとめりたんを賭けてジャンケン。\n` +
        `\`mgacha>\` : *${GACHA_MERITUM}めりたん* でガチャを回し、称号をゲット。\n` +
        `\`mmikuji>\` : *${OMIKUJI_MERITUM}めりたん* でおみくじを引き、今日の運勢を占って景品をもらおう。\n` +
        '`mself>` : 自分の順位、称号数、全称号、めりたんを表示。\n' +
        '`mranking>` : 称号数で決まるランキングを表示(同称号数なら、めりたんの数順)。\n' +
        '`mrank> (@ユーザー名)` : 指定したユーザーの順位、称号数、全称号、めりたんを表示。\n' +
        '`msend> (@ユーザー名) (数値)` : 指定したユーザーに数値で指定しためりたんを送る。\n' +
        `\`mbuy> (称号A-Z)\` : めりたんbotから * ${BUY_TITLE_PRICE}めりたん* で指定した称号を強制的に買い取る。`
    );
  });
};
