#!/usr/bin/env bash
set -euo pipefail

print_help() {
  cat <<'HELPEOF'
Usage: team.sh [OPTIONS]

Options:
  -t TYPE          Team type (e.g. dev, qa, ops)
  -s SUBTYPE       Team subtype
  -w WORKSPACE     Workspace path or name
  -T TASK          Task description
  -G GOAL          Goal description
  -p PROJECT_PATH  Project path
  -m MODEL         Model name (e.g. claude-sonnet-4-6)
  -v               Verbose output
  -d               Dry-run mode (print command, do not execute)
  -h               Show this help message

Examples:
  chmod +x deploy/team.sh
  ./deploy/team.sh -t dev -s backend -w ./workspace -T "Implement API" -G "Ship v1 endpoint" -p . -m claude-sonnet-4-6
  ./deploy/team.sh -t qa -s e2e -w ./workspace -T "Run regression" -G "Zero critical bugs" -p . -v -d
HELPEOF
}

TYPE=""
SUBTYPE=""
WORKSPACE=""
TASK=""
GOAL=""
PROJECT_PATH=""
MODEL=""
VERBOSE=false
DRY_RUN=false

while getopts ":t:s:w:T:G:p:m:vdh" opt; do
  case "${opt}" in
    t) TYPE="${OPTARG}" ;;
    s) SUBTYPE="${OPTARG}" ;;
    w) WORKSPACE="${OPTARG}" ;;
    T) TASK="${OPTARG}" ;;
    G) GOAL="${OPTARG}" ;;
    p) PROJECT_PATH="${OPTARG}" ;;
    m) MODEL="${OPTARG}" ;;
    v) VERBOSE=true ;;
    d) DRY_RUN=true ;;
    h)
      print_help
      exit 0
      ;;
    :)
      echo "Error: Option -${OPTARG} requires an argument." >&2
      print_help
      exit 1
      ;;
    \?)
      echo "Error: Invalid option -${OPTARG}" >&2
      print_help
      exit 1
      ;;
  esac
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 not found in PATH. Please install Python 3 and try again." >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="${SCRIPT_DIR}/../scripts/run_agent_team.py"

if [[ ! -f "${RUNNER}" ]]; then
  echo "Error: Runner script not found: ${RUNNER}" >&2
  exit 1
fi

CMD=(python3 "${RUNNER}")

[[ -n "${TYPE}" ]]         && CMD+=(-t "${TYPE}")
[[ -n "${SUBTYPE}" ]]      && CMD+=(-s "${SUBTYPE}")
[[ -n "${WORKSPACE}" ]]    && CMD+=(-w "${WORKSPACE}")
[[ -n "${TASK}" ]]         && CMD+=(-T "${TASK}")
[[ -n "${GOAL}" ]]         && CMD+=(-G "${GOAL}")
[[ -n "${PROJECT_PATH}" ]] && CMD+=(-p "${PROJECT_PATH}")
[[ -n "${MODEL}" ]]        && CMD+=(-m "${MODEL}")
[[ "${VERBOSE}" == true ]] && CMD+=(-v)
[[ "${DRY_RUN}" == true ]] && CMD+=(-d)

if [[ "${VERBOSE}" == true || "${DRY_RUN}" == true ]]; then
  echo "Running command:"
  printf '  %q' "${CMD[@]}"
  echo
fi

if [[ "${DRY_RUN}" == true ]]; then
  exit 0
fi

"${CMD[@]}"
