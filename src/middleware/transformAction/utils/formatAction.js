import { isRedirect, actionToUrl, nestAction } from '../../../utils'
import { replacePopAction, findNeighboringN } from './index'

export default (req) => {
  const { action, routes, options, history, prevRoute, getLocation, tmp } = req
  const { url, state } = !req.commitHistory
    ? actionToUrl(action, routes, options, prevRoute)
    : { url: action.location.url, state: action.state }

  const redirect = isRedirect(action)
  const redirectCommitted = redirect && (tmp.committed || !tmp.from || tmp.load)   // committed after `enter`, or if a redirect triggered from outside the pipeline, or on load where it must always be treated as a `replace` since the URL is already settled
  const status = action.location && action.location.status
  const curr = getLocation()

  let method = redirectCommitted ? 'replace' : 'push'                             // redirects before committing are just pushes (since the original route was never pushed)
  let pop
  let n

  if (!tmp.committed && (n = findNeighboringN(tmp.from, curr))) {
    method = 'replacePop'
    pop = replacePopAction(n, url, curr, tmp)
  }

  if (!req.commitHistory) {
    const { commit, ...action } = history[method](url, state, false, pop)         // get returned the same action as functions passed to `history.listen`
    req.commitHistory = commit                                                    // put this here so `enter` middleware can commit the history, etc
    req.action = action
  }

  // reset + jump actions provide custom `prev/from`
  const prev = action.prev || (tmp.load || redirectCommitted ? curr.prev : curr)  // `init` comes before initial `load` action, but they share the same `prev` state, as they are essentially the same, except the former is the initial state before any actions are dispatched; -- about `prev` vs `from`: `prev` maintains proper entries array, notwithstanding any redirects, whereas `from` honors where the user tried to go, but never became the location state
  const from = action.from || (redirect ? tmp.from || curr : undefined)           // `from` represents the route the user would have gone to had there been no redirect; `curr` used when redirect comes from outside of pipeline via `redirect` action creator

  return nestAction(req.action, prev, from, status, tmp)
}
