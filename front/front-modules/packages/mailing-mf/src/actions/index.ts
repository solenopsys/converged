
import OUTMAILS_ACTIONS from "./out-mails"
import STATISTIC_ACTIONS from "./statistic"
import INPUT_MAILS_ACTIONS from "./in-mails"
import CREDENTALS_ACTIONS from "./credentals"

export const ACTIONS=[
    ...CREDENTALS_ACTIONS,
    ...INPUT_MAILS_ACTIONS,
    ...OUTMAILS_ACTIONS, 
    ...STATISTIC_ACTIONS
]

export const ENTITIES = [
    'out_mail',
    'in_mail',
    'credental'
]

export * from "./out-mails";
export * from "./statistic";
export * from "./in-mails";
export * from "./credentals";