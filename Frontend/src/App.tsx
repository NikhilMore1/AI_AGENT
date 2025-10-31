import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './Pages/Home'
import ChatScreen from './Pages/ChatScreen'
import Registration from './Components/Authentication/Registration'
import Login from './Components/Authentication/Login'

function App() {
  return (
    <>
    <BrowserRouter>
    <Routes>
      <Route path='/login' element={<Login/>} />
      <Route path='/Registration' element={<Registration/>} />
      <Route path='/' element={<ChatScreen/>} />
    </Routes>
    </BrowserRouter>
    </>
  )
}

export default App