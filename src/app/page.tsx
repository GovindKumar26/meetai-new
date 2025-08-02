'use client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";


export default function Home() {

   const { 
        data: session
    } = authClient.useSession() 
 

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = () => {
    authClient.signUp.email({
      name,
      email,
      password
    },
    {
      onError: () => {
        window.alert("Sign up failed");
      },
      onSuccess: () => {
        window.alert("Sign up successful");
      }
    });
  };

  if (session) {
    return (
      <div className="flex flex-col p-4 gap-y-4" >
        <p>logged in as, {session.user.name}!</p>
        <Button onClick={() => authClient.signOut()}>Sign Out</Button>
      </div>
    );
  }


  return (
   <div >
    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
    <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />

    <Button onClick={onSubmit} className="bg-blue-500 text-white px-4 py-2 rounded mt-4">
      Sign Up
    </Button>

   </div>
  );
}
