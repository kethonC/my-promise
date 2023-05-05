
// promise的三种状态
const PENDING = 'PENDING'
const FULFILLED = 'FULFILLED'
const REJECTED = 'REJECTED'
function resolvePromise(promise2, x, resolve, reject) {
  // 1. 如果promise2 === x，需要reject一个类型错误
  if (x === promise2) {
    return reject(new TypeError(`Chaining cycle detected for promise #<Promise>`))
  }
  // 是对象或函数
  if (x !== null && (typeof x === 'function' || typeof x === 'object')) {
    let called = false // 保证只调用一次
    try {
      // 必须有then方法
      let then = x.then
      if (typeof then === 'function') {
        then.call(x, (y) => {
          if (called) return
          called = true
          // resolve(y)
          resolvePromise(promise2, y, resolve, reject)
        }, (r) => {
          if (called) return
          called = true
          reject(r)
        })
      } else { // 没有then方法按普通值处理
        resolve(x)
      }
    } catch (e) {
      if (called) return
      called = true
      reject(e)
    }
  } else { // 普通值
    resolve(x)
  }
}
class Promise {
  // 传入一个执行器
  constructor(executor) {
    // 初始状态是等待状态
    this.state = PENDING
    this.resolvedCallbacks = [] // 存放成功的回调
    this.rejectedCallbacks = [] // 存放失败的回调
    const resolve = (value) => {
      // 下面的这个规范没有要求
      if (value instanceof Promise) {
        return value.then(resolve, reject)
      }
      /**
       * 1. 调用resolve方法状态会改为FULFILLED
       * 2. 由于promise状态一旦改变，以后不能更改，所以只有在PENDING状态时才能改为FULFILLED
       */
      if (this.state === PENDING) {
        this.state = FULFILLED
        // 成功态时的数据
        this.value = value
        // 异步回调
        this.resolvedCallbacks.forEach(fn => fn())
      }
    }
    const reject = (reason) => {
      /**
       * 1. 调用resolve方法状态会改为REJECTED
       * 2. 由于promise状态一旦改变，以后不能更改，所以只有在PENDING状态时才能改为REJECTED
       */
      if (this.state === PENDING) {
        this.state = REJECTED
        // 失败态时的原因
        this.reason = reason
        // 异步回调
        this.rejectedCallbacks.forEach(fn => fn())
      }
    }
    /**
     * 该执行是立即执行的，并且会传入两个函数resolve, reject。
     * 如果执行器抛异常，走失败态。所以加上try/catch
     */
    try {
      executor(resolve, reject)
    } catch (e) {
      reject(e)
    }
  }
  then(onFulfilled, onRejected) {
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : v => v
    onRejected = typeof onRejected === 'function' ? onRejected : err => { throw err }
    const promise2 = new Promise((resolve, reject) => {
      // 根据状态调用不同的回调函数
      if (this.state === FULFILLED) {
        // 这里需要加上的setTimeout，才能访问到promise2，下同
        setTimeout(() => {
          try {
            // 返回普通值(x)，则直接传递下一个then中的onFulfilled，即直接resolve(x), 下同
            let x = onFulfilled(this.value)
            resolvePromise(promise2, x, resolve, reject)
          } catch (e) {
            reject(e)
          }
        })
      }
      if (this.state === REJECTED) {
        setTimeout(() => {
          try {
            let x = onRejected(this.reason)
            resolvePromise(promise2, x, resolve, reject)
          } catch (e) {
            reject(e)
          }
        })
      }
      // pending状态，异步调用，需要把回调存起来
      if (this.state === PENDING) {
        this.resolvedCallbacks.push(() => {
          setTimeout(() => {
            try {
              let x = onFulfilled(this.value)
              resolvePromise(promise2, x, resolve, reject)
            } catch (e) {
              reject(e)
            }
          })
        })
        this.rejectedCallbacks.push(() => {
          setTimeout(() => {
            try {
              let x = onRejected(this.reason)
              resolvePromise(promise2, x, resolve, reject)
            } catch (e) {
              reject(e)
            }
          })
        })
      }
    })
    return promise2
  }
  catch(fn) {
    return this.then(null, fn)
  }
  finally(fn) {
    return this.then((value) => {
      return Promise.resolve(fn()).then(() => value)
    }, (err) => {
      return Promise.resolve(fn()).then(() => { throw err })
    })
  }
  static resolve(data) {
    return new Promise((resolve) => {
      resolve(data)
    })
  }
  static reject(data) {
    return new Promise((resolve, reject) => {
      reject(data)
    })
  }
  static all(promises) {
    return new Promise((resolve, reject) => {
      let result = []
      let times = 0
      const processSuccess = (index, value) => {
        result[i] = value
        if (++times === promises.length) {
          resolve(result)
        }
      }
      for (let i = 0; i < promises.length; i++) {
        let p = promises[i]
        // 判断p是否为promise,即判断有没有then方法
        if (p && typeof p.then === 'function') {
          p.then((value) => {
            processSuccess(i, value)
          }, reject)
        } else {
          processSuccess(i, p)
        }
      }
    })
  }
  static race(promises) {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        const p = promises[i]
        if (p && typeof p.then === 'function') {
          p.then(resolve, reject)
        } else {
          resolve(p)
        }
      }
    })
  }
  static allSettled(promises) {

    let result = []
    let times = 0

    return new Promise((resolve, reject) => {
      const processComplete = (index, data, state) => {
        result[index] = {
          state,
          ...data
        }
        if (++times === promises.length) {
          resolve(result)
        }
      }
      for (let i = 0; i < promises.length; i++) {
        const p = promises[i]
        if (p && typeof p.then === 'function') {
          p.then((value) => {
            processComplete(i, { value }, 'fulfilled')
          }, (reason) => {
            processComplete(i, { reason }, 'rejected')
          })
        } else {
          processComplete(i, { value: p }, 'fulfilled')
        }
      }
    })
  }
  static any(promises) {
    let result = []
    let resolveValue
    let hasResolved = false
    let times = 0
    return new Promise((resolve, reject) => {
      const processFail = (index, reason) => {
        result[index] = reason
        if(++times === promises.length) {
          reject(new AggregateError(result, 'All promises were rejected'))
        }
      }
      const processSuccess = (index, value) => {
        if (!hasResolved) {
          resolveValue = value
          hasResolved = true
        }
        if(++times === promises.length) {
          resolve(resolveValue)
        }
      }
      for (let i = 0; i < promises.length; i++) {
        let p = promises[i]
        p.then((value) => {
          processSuccess(i, value)
        }, (reason) => {
          processFail(i, reason)
        })
      }
    })
  }
}

// promises-aplus-tests
Promise.deferred = function() {
  let dfd = {}
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve
    dfd.reject = reject
  })
  return dfd
}
module.exports = Promise