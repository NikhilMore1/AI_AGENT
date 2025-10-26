import express from 'express';
import {loginUser, registerUser} from '../../Controllers/auth/Registration.controllers.js';
const router = express.Router();

router.post('/register' ,registerUser);
router.post('/login',loginUser);
export default router;
