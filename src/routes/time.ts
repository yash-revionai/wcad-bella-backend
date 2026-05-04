import { Router } from "express";
import { DateTime } from "luxon";
import { validateApiKey } from "../middleware/auth.js";

export const timeRouter = Router();

const businessZone = "America/New_York";
const mobileSameDayCutoffTime = "14:00";

function applyTime(date: DateTime, time: string) {
  const [hourRaw, minuteRaw] = time.split(":");
  return date.set({
    hour: Number(hourRaw),
    minute: Number(minuteRaw),
    second: 0,
    millisecond: 0
  });
}

timeRouter.get("/", validateApiKey, (_req, res) => {
  const now = DateTime.now().setZone(businessZone);
  const mobileCutoff = applyTime(now, mobileSameDayCutoffTime);

  res.json({
    timezone: businessZone,
    nowIso: now.toISO(),
    today: now.toISODate(),
    tomorrow: now.plus({ days: 1 }).toISODate(),
    dayOfWeek: now.toFormat("cccc"),
    currentTime: now.toFormat("h:mm a"),
    currentDateForSpeech: now.toFormat("cccc, LLLL d, yyyy"),
    mobileSameDayCutoffTime,
    isAfterMobileSameDayCutoff: now >= mobileCutoff,
    result: `The current business date is ${now.toFormat("cccc, LLLL d, yyyy")}, and the current business time is ${now.toFormat("h:mm a")} ${now.offsetNameShort}.`
  });
});
