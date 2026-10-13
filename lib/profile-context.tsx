'use client';
import {createContext,useContext} from 'react';
import type {Profile} from './roles';
export const ProfileContext=createContext<Profile|null>(null);
export function useProfile(){const profile=useContext(ProfileContext);if(!profile)throw new Error('User access has not been checked.');return profile}
