import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Home from './Pages/Home'
import ChatScreen from './Pages/ChatScreen'

function App() {
  return (
    <>
    <BrowserRouter>
    <Routes>
      <Route path='/Home' element={<Home/>} />
    </Routes>
    </BrowserRouter>
    </>
  )
}

export default App