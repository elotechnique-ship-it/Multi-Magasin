// Exécute psql : celui de l'hôte s'il existe, SINON celui du conteneur Docker local (aucun client PostgreSQL à installer).
// Le SQL est transmis par l'entrée standard (« -f - »), ce qui évite tout problème de chemin Windows/conteneur.
import { spawnSync } from "node:child_process";

const LOCAL_COMPOSE = "127.0.0.1:5433";
let hostPsql;
export function hasHostPsql() {
  if (hostPsql === undefined) hostPsql = spawnSync("psql", ["--version"], { encoding: "utf8" }).status === 0;
  return hostPsql;
}

export function runPsql({ url, args = [], input, cwd, capture = false }) {
  let cmd;
  let full;
  if (hasHostPsql()) {
    cmd = "psql";
    full = ["-X", "-v", "ON_ERROR_STOP=1", url, ...args];
  } else if (url.includes(`@${LOCAL_COMPOSE}/`)) {
    cmd = "docker";
    full = ["compose", "exec", "-T", "db", "psql", "-X", "-v", "ON_ERROR_STOP=1", url.replace(`@${LOCAL_COMPOSE}/`, "@127.0.0.1:5432/"), ...args];
  } else {
    throw new Error("client psql introuvable : installez les outils en ligne de commande de PostgreSQL pour atteindre une base non locale");
  }
  const stdio = capture ? "pipe" : [input !== undefined ? "pipe" : "inherit", "inherit", "inherit"];
  return spawnSync(cmd, full, { cwd, input, encoding: "utf8", stdio });
}
