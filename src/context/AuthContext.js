// ** React Imports
import { createContext, useEffect, useState } from 'react'

// ** Next Import
import { useRouter } from 'next/router'

// ** Axios
import axios from 'axios'

// ** Config
import authConfig from 'src/configs/auth'

import { Auth, API, syncExpression, Hub } from 'aws-amplify'
import { DataStore, Predicates } from '@aws-amplify/datastore'

// import { CognitoHostedUIIdentityProvider } from '@aws-amplify/auth'
// import { User, StripeProfile, ReqHistory, GoogleDocRefKey } from '../models'

// import { getStripeProfile } from '/src/graphql/mutations'
// import * as queries from '/src/graphql/queries.js'
// import * as mutations from '/src/graphql/mutations.js'
// import api from 'src/configs/api'

// ** Defaults
const defaultProvider = {
  user: null,
  loading: true,
  setUser: () => null,
  setLoading: () => Boolean,
  login: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  register: () => Promise.resolve(),
  confirm: () => Promise.resolve(),
  resend: () => Promise.resolve()
}
const AuthContext = createContext(defaultProvider)

const AuthProvider = ({ children }) => {
  // ** States
  const [user, setUser] = useState(defaultProvider.user)
  const [loading, setLoading] = useState(defaultProvider.loading)

  // ** Hooks
  const router = useRouter()
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = window.localStorage.getItem(authConfig.storageTokenKeyName)
      if (storedToken) {
        setLoading(true)
        await axios
          .get(authConfig.meEndpoint, {
            headers: {
              Authorization: storedToken
            }
          })
          .then(async response => {
            setLoading(false)
            setUser({ ...response.data.userData })
          })
          .catch(() => {
            localStorage.removeItem('userData')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('accessToken')
            setUser(null)
            setLoading(false)
            if (authConfig.onTokenExpiration === 'logout' && !router.pathname.includes('login')) {
              router.replace('/login')
            }
          })
      } else {
        setLoading(false)
      }
    }
    initAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogin = (params, errorCallback) => {
    // Use the `Auth.signIn` method to sign in the user with the provided username
    // and password.
    try {
      console.log(params)
      Auth.signIn(params.username, params.password)
        .then(async userData => {
          // Set the user data to the local state.
          console.log(userData)
          setLoading(true)

          const user = {
            role: 'client',
            username: userData.username,
            email: userData.attributes.email
          }

          const returnUrl = router.query.returnUrl
          setUser({ ...user })
          console.log(user)

          // await refreshStripe(false)

          // Record new user and old user previous in this browser
          let curUser = JSON.stringify(user)
          let oldUser = window.localStorage.getItem('userData')

          // Get the return URL from the router query, if it exists, and redirect the user
          // to the specified URL or to the root URL if no return URL was specified.
          params.rememberMe ? window.localStorage.setItem('userData', curUser) : null
          const redirectURL = returnUrl && returnUrl !== '/' ? returnUrl : '/'

          // Handle account mutual exclusion in the same browser
          refresh = () => {
            if (!(window.localStorage.getItem('userData') === curUser)) {
              window.removeEventListener('storage', refresh)
              location.reload()
            }
          }
          window.addEventListener('storage', refresh)

          // To avoid data conflict when there is a different user signed in
          if (!(oldUser === curUser)) {
            await DataStore.clear()
          }

          // Pre-sync data with datastore
          await DataStore.start()

          // let u = await refreshUser(user)
          if (u.onboard_status === 'finished') {
            router.replace(redirectURL)
          }
          setLoading(false)
        })
        .catch(err => {
          errorCallback ? errorCallback(err) : null
          console.log(err)
        })
    } catch (err) {
      // If an error occurred, throw it so it can be handled by the caller.
      errorCallback ? errorCallback(err) : null
      console.log(err)
    }
  }

  const handleLogout = async () => {
    // Use the Auth.signOut method to sign out the current user.

    const userData = await Auth.currentAuthenticatedUser()

    setUser(null)

    // setStripe(null)
    window.localStorage.removeItem('userData')

    // window.localStorage.removeItem('googleAuthClient')

    await Auth.signOut()
      .then(() => {
        // Set the user to null and the initialized state to false.
        console.log('signing out...')

        // Redirect the user to the login page.
        router.push('/login')
      })
      .catch(err => {
        // If an error occurred, throw it so it can be handled by the caller.
        throw err
      })
    window.removeEventListener('storage', refresh)
  }

  const confirmSignUp = async (username, confirmation) => {
    try {
      await Auth.confirmSignUp(username, confirmation)
    } catch (error) {
      throw error
    }
  }

  async function resendConfirmationCode(params) {
    try {
      await Auth.resendSignUp(params.username)
      console.log('code resent successfully')
    } catch (err) {
      console.log('error resending code: ', err)
    }
  }

  const handleRegister = async (params, errorCallback) => {
    try {
      const { user, userSub } = await Auth.signUp({
        username: params.username,
        password: params.password,
        attributes: {
          email: params.email
        }
      })
      console.log('Sign-up successful')
      console.log(userSub, params)
    } catch (error) {
      console.log('Error signing up: ', error)
    }
  }

  //   axios
  //     .post(authConfig.registerEndpoint, params)
  //     .then(res => {
  //       if (res.data.error) {
  //         if (errorCallback) errorCallback(res.data.error)
  //       } else {
  //         handleLogin({ email: params.email, password: params.password })
  //       }
  //     })
  //     .catch(err => (errorCallback ? errorCallback(err) : null))
  // }

  const values = {
    user,
    loading,
    setUser,
    setLoading,
    login: handleLogin,
    logout: handleLogout,
    register: handleRegister,
    confirm: confirmSignUp,
    resend: resendConfirmationCode
  }

  return <AuthContext.Provider value={values}>{children}</AuthContext.Provider>
}

export { AuthContext, AuthProvider }
