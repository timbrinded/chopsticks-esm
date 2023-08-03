import author from './author.js'
import chain from './chain.js'
import payment from './payment.js'
import state from './state.js'
import system from './system.js'

import { Handlers } from '../shared.js'

const handlers: Handlers = {
  ...author,
  ...chain,
  ...state,
  ...system,
  ...payment,
}

export default handlers
