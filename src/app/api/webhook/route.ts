
import {
    CallEndedEvent,
    MessageNewEvent,

    CallTranscriptionReadyEvent,
    CallSessionParticipantLeftEvent,
    CallRecordingReadyEvent,
    CallSessionStartedEvent,
} from '@stream-io/node-sdk'
import { generatedAvatarUri } from '@/lib/avatar'

import { and, eq, not } from 'drizzle-orm'
import { db } from '@/db'
import { agents, meetings } from '@/db/schema'
import { streamVideo } from '@/lib/stream-video'
import { NextRequest, NextResponse } from 'next/server'

import { inngest } from '@/inngest/client'
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs'
import OpenAI from 'openai'
import { streamChat } from '@/lib/stream-chat'


const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function verifySignatureWithSDK(body: string, signature: string): boolean {
    return streamVideo.verifyWebhook(body, signature);
};

// export async function POST(req: NextRequest) {
//     const signature = req.headers.get("x-signature");
//     const apiKey = req.headers.get("x-api-key");

//     if(!signature || !apiKey) {
//         return NextResponse.json(
//             {error: "Missing signature or API key"},
//             {status: 400}
//         );
//     }

//     const body = await req.text();

//     if(!verifySignatureWithSDK(body, signature)) {
//         return NextResponse.json({error: "Invalid signature"}, {status: 401});
//     }

//     let payload: unknown;

//     try {
//         payload = JSON.parse(body) as Record<string, unknown>;
//     } catch (error) {
//         return NextResponse.json({error: "Invalid JSON"}, {status: 400})
//     }

//     const eventType = (payload as Record<string, unknown>)?.type ;

//     if(eventType==="call.session_started") {
//         const event = payload as CallSessionStartedEvent;
//         const meetingId = event.call.custom?.meetingId;

//          if(!meetingId) {
//         return NextResponse.json({error: "Missing meetingId"}, {status: 400});
//     }

//     const [existingMeeting] = await db
//         .select()
//         .from(meetings)
//         .where(
//             and(
//                 eq(meetings.id, meetingId),
//                 not(eq(meetings.status, "completed")),
//                 not(eq(meetings.status, "active")),
//                 not(eq(meetings.status, "cancelled")),
//                 not(eq(meetings.status, "processing")),
//             )
//         );

//         if(!existingMeeting) {
//             return NextResponse.json({error: "Meeting not found"}, {status: 404});
//         }

//         await db
//             .update(meetings)
//             .set({
//                 status: "active",
//                 startedAt: new Date(),
//             })
//             .where(eq(meetings.id, existingMeeting.id));

//         const [existingAgent] = await db
//             .select()
//             .from(agents)
//             .where(eq(agents.id, existingMeeting.agentId));

//         if(!existingAgent) {
//             return NextResponse.json({error: "Agent not found"}, {status: 404});

//         }

//         const call = streamVideo.video.call("default", meetingId);
//         const realtimeClient = await streamVideo.video.connectOpenAi({
//             call,
//             openAiApiKey: process.env.OPENAI_API_KEY!,
//             agentUserId: existingAgent.id,
//         });

//         realtimeClient.updateSession({
//             instructions: existingAgent.instructions,
//         });
//     } else if(eventType==='call.session_participant_left') {
//         const event = payload as CallSessionParticipantLeftEvent;
//         const meetingId = event.call_cid.split(":")[1];

//         if(!meetingId) {
//             return NextResponse.json({error: "Missing meetingId"}, {status: 400});
//         }

//         const call = streamVideo.video.call("default", meetingId);
//         await call.end();
//     }


//     return NextResponse.json({status:"ok"});
// }

export async function POST(req: NextRequest) {
    const signature = req.headers.get("x-signature");
    const apiKey = req.headers.get("x-api-key");

//    console.log("🔔 Webhook hit!");

    if (!signature || !apiKey) {
    //    console.error("❌ Missing signature or API key");
        return NextResponse.json(
            { error: "Missing signature or API key" },
            { status: 400 }
        );
    }

    const rawBody = await req.text();
//    console.log("📦 Raw body received:", rawBody);

    if (!verifySignatureWithSDK(rawBody, signature)) {
     //   console.error("❌ Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: any;
    try {
        payload = JSON.parse(rawBody);
     //   console.log("✅ Payload parsed:", payload);
    } catch  {
   
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = payload?.type;
   // console.log("📣 Event type:", eventType);

    if (eventType === "call.session_started") {
        const event = payload as CallSessionStartedEvent;
        const meetingId = event.call.custom?.meetingId;

    

        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        const [existingMeeting] = await db
            .select()
            .from(meetings)
            .where(
                and(
                    eq(meetings.id, meetingId),
                    not(eq(meetings.status, "completed")),
                    not(eq(meetings.status, "active")),
                    not(eq(meetings.status, "cancelled")),
                    not(eq(meetings.status, "processing"))
                )
            );

        if (!existingMeeting) {
       //     console.warn("⚠️ Meeting not found or already active:", meetingId);
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        await db
            .update(meetings)
            .set({
                status: "active",
                startedAt: new Date(),
            })
            .where(eq(meetings.id, existingMeeting.id));

      //  console.log("📅 Meeting marked as active:", existingMeeting.id);

        const [existingAgent] = await db
            .select()
            .from(agents)
            .where(eq(agents.id, existingMeeting.agentId));

        if (!existingAgent) {
            console.error("❌ Agent not found:", existingMeeting.agentId);
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

      //  console.log("🤖 Agent found:", existingAgent);

        const call = streamVideo.video.call("default", meetingId);

      //  console.log("🔗 Connecting OpenAI agent...");

        try {
            const realtimeClient = await streamVideo.video.connectOpenAi({
                call,
                openAiApiKey: process.env.OPENAI_API_KEY!,
                agentUserId: existingAgent.id,
            });

         //   console.log("✅ Realtime client connected. Updating session...");
          //  console.log("🤖 RealtimeClient connected:", !!realtimeClient);
          //  console.log("🤖 RealtimeClient keys:", Object.keys(realtimeClient || {}));

            await realtimeClient.updateSession({
                instructions: existingAgent.instructions,
            });

         //   console.log("📘 Instructions sent:", existingAgent.instructions);
        } catch  {
            return NextResponse.json({ error: "Agent connection failed" }, { status: 500 });
        }
    } else if (eventType === "call.session_participant_left") {
        const event = payload as CallSessionParticipantLeftEvent;
        const meetingId = event.call_cid.split(":")[1];

       // console.log("🚪 Participant left call:", meetingId);

        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }
        const call = streamVideo.video.call("default", meetingId);
        await call.end();

      //  console.log("📴 Call ended:", meetingId);
    } else if (eventType === 'call.session_ended') {
        const event = payload as CallEndedEvent;
        const meetingId = event.call.custom?.meetingId;

        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        await db.
            update(meetings)
            .set({
                status: "processing",
                endedAt: new Date(),
            })
            .where(and(eq(meetings.id, meetingId), eq(meetings.status, "active")));

    } else if (eventType === 'call.transcription_ready') {
        const event = payload as CallTranscriptionReadyEvent;
        const meetingId = event.call_cid.split(":")[1];

        const [updatedMeeting] = await db
            .update(meetings)
            .set({
                transcriptUrl: event.call_transcription.url,
            })
            .where(eq(meetings.id, meetingId))
            .returning();

        if (!updatedMeeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }
        // call ingest background job
        await inngest.send({
            name: "meetings/processing",
            data: {
                meetingId: updatedMeeting.id,
                transcriptUrl: updatedMeeting.transcriptUrl,
            }
        });

    } else if (eventType === 'call.recording_ready') {
        const event = payload as CallRecordingReadyEvent;
        const meetingId = event.call_cid.split(":")[1];

        await db
            .update(meetings)
            .set({
                recordingUrl: event.call_recording.url,
            })
            .where(eq(meetings.id, meetingId))

    } else if (eventType === 'message.new') {
        const event = payload as MessageNewEvent;

        const userId = event.user?.id;
        const channelId = event.channel_id;
        const text = event.message?.text;

        if (!userId || !channelId || !text) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const [existingMeeting] = await db
            .select()
            .from(meetings)
            .where(and(eq(meetings.id, channelId), eq(meetings.status, "completed")));

        if (!existingMeeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

        }

        const [existingAgent] = await db
            .select()
            .from(agents)
            .where(eq(agents.id, existingMeeting.agentId));

        if (!existingAgent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });

        }

        if (userId !== existingAgent.id) {
            const instructions = `
      You are an AI assistant helping the user revisit a recently completed meeting.
      Below is a summary of the meeting, generated from the transcript:
      
      ${existingMeeting.summary}
      
      The following are your original instructions from the live meeting assistant. Please continue to follow these behavioral guidelines as you assist the user:
      
      ${existingAgent.instructions}
      
      The user may ask questions about the meeting, request clarifications, or ask for follow-up actions.
      Always base your responses on the meeting summary above.
      
      You also have access to the recent conversation history between you and the user. Use the context of previous messages to provide relevant, coherent, and helpful responses. If the user's question refers to something discussed earlier, make sure to take that into account and maintain continuity in the conversation.
      
      If the summary does not contain enough information to answer a question, politely let the user know.
      
      Be concise, helpful, and focus on providing accurate information from the meeting and the ongoing conversation.
      `;

      const channel = streamChat.channel("messaging", channelId);
      await channel.watch();
      
      const previousMessages = channel.state.messages
            .slice(-5)
            .filter((msg) => msg.text && msg.text.trim() !=="")
            .map<ChatCompletionMessageParam>((messages) => ({
                role: messages.user?.id === existingAgent.id ? "assistant" : "user",
                content: messages.text || "",
            }));

            const GPTResponse = await openaiClient.chat.completions.create({
                messages: [
                    {role: "system", content: instructions},
                    ...previousMessages,
                    {role: "user", content: text},
                ],
                model: 'gpt-4',
            });

            const GPTResponseText = GPTResponse.choices[0].message.content;

            if(!GPTResponseText) {
                return NextResponse.json(
                    {error: "No response from GPT"},
                    {status: 400}
                );
            }

            const avatarUrl = generatedAvatarUri({
                seed: existingAgent.name,
                variant: "botttsNeutral",
            });

            streamChat.upsertUser({
                id: existingAgent.id,
                name: existingAgent.name,
                image: avatarUrl,
            });

            channel.sendMessage({
                text: GPTResponseText,
                user: {
                    id: existingAgent.id,
                    name: existingAgent.name,
                    image: avatarUrl,
                }
            })
        }
    }



    return NextResponse.json({ status: "ok" });
}
