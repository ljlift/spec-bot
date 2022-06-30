import { Probot } from "probot";
import { handlePullOpened } from "./pull";

export = (app: Probot) => {
  app.on("pull_request.opened", handlePullOpened);

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
