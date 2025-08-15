import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import sendEmail from "../configs/nodeMailer.js";


// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking", eventKey: process.env.INNGEST_EVENT_KEY });
// Inngest Function to save user data to a database
const syncUserCreation = inngest.createFunction(
    {id: 'sync-user-from-clerk'},
    {event: 'clerk/user.created'},
    async ({ event }) => {
        const {id, first_name, last_name, email_addresses, image_url } = event.data;
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        };
        console.log(userData);
        await User.create(userData);
    }
);

// Inngest Function to delete user data from database
const syncUserDeletion = inngest.createFunction(
    {id: 'delete-user-from-clerk'},
    {event: 'clerk/user.deleted'},
    async ({ event }) => {

        const { id } = event.data;
        await User.findByIdAndDelete(id);
    }
);

// Inngest Function to update user data to a database
const syncUserUpdation = inngest.createFunction(
    {id: 'update-user-from-clerk'},
    {event: 'clerk/user.updated'},
    async ({ event }) => {

        const {id, first_name, last_name, email_addresses, image_url } = event.data;
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            image: image_url
        };
        await User.findByIdAndUpdate(id, userData);
    }
);

// Inngest function to cancel booking and release seats of show after 10 minutes of booking created if payment is not made
const releaseSeatsAndDeleteBooking = inngest.createFunction(
    {id: 'release-seats-and-delete-booking'},
    {event: "app/checkpayment"},
    async ({event, step}) => {
        const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);
        await step.sleepUntil('wait-for-10-minutes', tenMinutesLater);

        await step.run('check-payment-status', async () => {
            const bookingId = event.data.bookingId;
            const booking = await Booking.findById(bookingId);

            // If payment is not made, release seats and delete booking
            if(!booking.isPaid) {
                const show = await Show.findById(booking.show);
                booking.bookedSeats.forEach((seat) => {
                    delete show.occupiedSeats[seat];
                });

                show.markModified('occupiedSeats');
                await show.save();
                await booking.findByIdAndDelete(booking._id);
            }
        })
    }

);

// Inngest function to send email email when user books a show
const sendBookingConfirmationEmail = inngest.createFunction(
    {id: "send-booking-confirmation-email"},
    {event: "app/show.booked"},
    async ({event, step}) => {
        const { bookingId } = event.data;

        const booking = await Booking.findById(bookingId).populate({
            path: 'show',
            populate: {path: "movie", model: "Movie"}
        }).populate('user');

        await sendEmail({
            to: booking.user.email,
            subject: `Payment Confirmation: "${booking.show.movie.title}" booked!`,
            body: `<div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Hi ${Booking.user.name},</h2>
        <p>Your Booking for<strong style="color: #F84565;">"${Booking.show.movie.title}"</strong> is confirmed.</p>
        <p>
          <strong>:</strong> ${new Date(Booking.show.showDateTime).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })} <br />
        </p>
        <p>Enjoy the show!</p>
        <p>Thanks for booking with us!<br />- QuickShow Team</p>
      </div>`,
        });
    }
);

// Inngest function to send reminders
const sendShowReminders = inngest.createFunction(
    {id: "send-show-reminders"},
    { cron: "0 */8 * * *" }, // Every 8 hours
    async ({ step }) => {
        const now = new Date();
        const in8Hours = new Date(now.getTime() + 8 * 60 * 60 * 1000);

        // prepare reminder tasks
        const reminderTasks = await step.run(
            "prepare-reminder-tasks",
            async () => {
                const shows = await Show.find(
                    { showTime: { $gte: windowStart, $lte: in8Hours},
                }).populate('movie');

                const tasks = [];

                for(const show of shows) {
                    if(!show.movie || !show.occupiedSeats) continue;

                    const userIds = [...new Set(Object.values(show.occupiedSeats))];
                    if(userIds.length === 0) continue;

                    const users = await User.find({_id: {$in: userIds}}).select("name email");

                    for(const user of users) {
                        tasks.push({
                            userEmail: user.email,
                            userName: user.name,
                            movieTitle: show.movie.title,
                            showTime: show.showTime,
                        });
                    }
                }

                return tasks;

            }
         );

         if(reminderTasks.length === 0) {
            return {sent: 0, message: "No reminders to send."}
         }

         // Send reminder emails
         const results = await step.run('send-all-reminders', async ()=> {
            return await Promise.allSettled(
                reminderTasks.map(task => sendEmail({
                    to: task.userEmail,
                    subject: `Reminder: Your movie "${task.movieTitle}" starts soon!`,
                    body: `<div style="font-family: Arial, sans-serif; padding: 20px;">
                                <h2>Hello ${task.userName},</h2>
                                <p>This is a quick reminder that your movie:</p>
                                <h3 style="color: #F84565">${task.movieTitle}</h3>
                                <p>
                                 is scheduled for <strong>${new Date(task.showTime).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}</strong> at 
                                 <strong>${new Date(task.showTime).toLocaleTimeString('en-US', { timeZone: 'Asia/kolkata' })}</strong>.
                                </p>
                                <p>It starts in approximately <strong>8 hours</strong>
                                - make sure you're ready!</p>
                                <p>Enjoy the show!<br />- QuickShow Team</p>
                            </div>`,
                }))
                
            )
         })

         const send = results.filter(r => r.status === "fulfilled").length;
         const failed = results.length - sent;

         return {
            sent,
            failed,
            message: `Sent ${sent} reminder(s), ${failed} failed.`
         }

    }
);

// Inngest function to send notification when a new show is added
const sendNewShowNotifications = inngest.createFunction(
    {id: "send-new-show-notifications"},
    { event: "app/show.added" },
    async ({ event }) => {
        const { movieTitle } = event.data;

        const users = await User.email;

        for(const user of users) {
            const userEmail = user.email;
            const userName = user.name;

            const subject = `filmIcon New Show Added: ${movieTitle}`;
            const body = `<div style="font-family: Arial, sans-serif; padding: 20px;">
                                <h2>Hi ${userName},</h2>
                                <p>We've just added a new show to our library:</p>
                                <h3 style="color: #F84565">${movieTitle}</h3>
                                <p>Visit our website</p>
                                <br />
                                <p>Thanks<br />- QuickShow Team</p>
                            </div>`;

                await sendEmail({
                    to: userEmail,
                    subject,
                    body,
                });
        }

        return {message: "Notifications sent." }

    }
);

// Export all Inngest functions
export const functions = [
    syncUserCreation, 
    syncUserDeletion, 
    syncUserUpdation, 
    releaseSeatsAndDeleteBooking,
    sendBookingConfirmationEmail,
    sendShowReminders,
    sendNewShowNotifications
];




// import { Inngest } from "inngest";
// import User from "../models/User.js";
// import Booking from "../models/Booking.js";
// import Show from "../models/Show.js";
// import sendEmail from "../configs/nodeMailer.js";

// // Create a client to send and receive events
// export const inngest = new Inngest({ 
//     id: "movie-ticket-booking", 
//     eventKey: process.env.INNGEST_EVENT_KEY 
// });

// // Inngest Function to save user data to a database
// const syncUserCreation = inngest.createFunction(
//     { id: 'sync-user-from-clerk' },
//     { event: 'clerk/user.created' },
//     async ({ event }) => {
//         try {
//             console.log('Clerk user.created event received:', event.data);
            
//             const { id, first_name, last_name, email_addresses, image_url } = event.data;
            
//             // Handle cases where name might be null/undefined
//             const firstName = first_name || '';
//             const lastName = last_name || '';
//             const fullName = `${firstName} ${lastName}`.trim() || 'User';
            
//             // Handle cases where email_addresses might be empty
//             if (!email_addresses || email_addresses.length === 0) {
//                 console.error('No email addresses found for user:', id);
//                 return;
//             }

//             const userData = {
//                 _id: id,
//                 email: email_addresses[0].email_address,
//                 name: fullName,
//                 image: image_url || ''
//             };
            
//             console.log('Creating user with data:', userData);
            
//             // Use upsert to avoid duplicate key errors
//             const user = await User.findOneAndUpdate(
//                 { _id: id },
//                 userData,
//                 { upsert: true, new: true }
//             );
            
//             console.log('User created/updated successfully:', user._id);
//             return { success: true, userId: user._id };
            
//         } catch (error) {
//             console.error('Error in syncUserCreation:', error);
//             throw error;
//         }
//     }
// );

// // Inngest Function to delete user data from database
// const syncUserDeletion = inngest.createFunction(
//     { id: 'delete-user-from-clerk' },
//     { event: 'clerk/user.deleted' },
//     async ({ event }) => {
//         try {
//             console.log('Clerk user.deleted event received:', event.data);
            
//             const { id } = event.data;
//             const deletedUser = await User.findByIdAndDelete(id);
            
//             if (deletedUser) {
//                 console.log('User deleted successfully:', id);
//                 return { success: true, deletedUserId: id };
//             } else {
//                 console.log('User not found for deletion:', id);
//                 return { success: false, message: 'User not found' };
//             }
            
//         } catch (error) {
//             console.error('Error in syncUserDeletion:', error);
//             throw error;
//         }
//     }
// );

// // Inngest Function to update user data to a database
// const syncUserUpdation = inngest.createFunction(
//     { id: 'update-user-from-clerk' },
//     { event: 'clerk/user.updated' },
//     async ({ event }) => {
//         try {
//             console.log('Clerk user.updated event received:', event.data);
            
//             const { id, first_name, last_name, email_addresses, image_url } = event.data;
            
//             // Handle cases where name might be null/undefined
//             const firstName = first_name || '';
//             const lastName = last_name || '';
//             const fullName = `${firstName} ${lastName}`.trim() || 'User';
            
//             // Handle cases where email_addresses might be empty
//             if (!email_addresses || email_addresses.length === 0) {
//                 console.error('No email addresses found for user update:', id);
//                 return;
//             }

//             const userData = {
//                 email: email_addresses[0].email_address,
//                 name: fullName,
//                 image: image_url || ''
//             };
            
//             console.log('Updating user with data:', userData);
            
//             const updatedUser = await User.findByIdAndUpdate(id, userData, { new: true });
            
//             if (updatedUser) {
//                 console.log('User updated successfully:', updatedUser._id);
//                 return { success: true, userId: updatedUser._id };
//             } else {
//                 console.log('User not found for update:', id);
//                 return { success: false, message: 'User not found' };
//             }
            
//         } catch (error) {
//             console.error('Error in syncUserUpdation:', error);
//             throw error;
//         }
//     }
// );

// // Inngest function to cancel booking and release seats of show after 10 minutes of booking created if payment is not made
// const releaseSeatsAndDeleteBooking = inngest.createFunction(
//     { id: 'release-seats-and-delete-booking' },
//     { event: "app/checkpayment" },
//     async ({ event, step }) => {
//         const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);
//         await step.sleepUntil('wait-for-10-minutes', tenMinutesLater);

//         await step.run('check-payment-status', async () => {
//             try {
//                 const bookingId = event.data.bookingId;
//                 const booking = await Booking.findById(bookingId);

//                 if (!booking) {
//                     console.log('Booking not found:', bookingId);
//                     return;
//                 }

//                 // If payment is not made, release seats and delete booking
//                 if (!booking.isPaid) {
//                     const show = await Show.findById(booking.show);
//                     if (show) {
//                         booking.bookedSeats.forEach((seat) => {
//                             delete show.occupiedSeats[seat];
//                         });

//                         show.markModified('occupiedSeats');
//                         await show.save();
//                     }
                    
//                     await Booking.findByIdAndDelete(bookingId); // Fixed: was using booking._id
//                     console.log('Booking deleted due to non-payment:', bookingId);
//                 }
//             } catch (error) {
//                 console.error('Error in releaseSeatsAndDeleteBooking:', error);
//                 throw error;
//             }
//         });
//     }
// );

// // Inngest function to send email when user books a show
// const sendBookingConfirmationEmail = inngest.createFunction(
//     { id: "send-booking-confirmation-email" },
//     { event: "app/show.booked" },
//     async ({ event, step }) => {
//         try {
//             const { bookingId } = event.data;

//             const booking = await Booking.findById(bookingId).populate({
//                 path: 'show',
//                 populate: { path: "movie", model: "Movie" }
//             }).populate('user');

//             if (!booking || !booking.user || !booking.show || !booking.show.movie) {
//                 console.error('Incomplete booking data for email:', bookingId);
//                 return;
//             }

//             await sendEmail({
//                 to: booking.user.email,
//                 subject: `Payment Confirmation: "${booking.show.movie.title}" booked!`,
//                 body: `<div style="font-family: Arial, sans-serif; line-height: 1.5;">
//             <h2>Hi ${booking.user.name},</h2>
//             <p>Your Booking for <strong style="color: #F84565;">"${booking.show.movie.title}"</strong> is confirmed.</p>
//             <p>
//               <strong>Date:</strong> ${new Date(booking.show.showDateTime).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })} <br />
//             </p>
//             <p>Enjoy the show!</p>
//             <p>Thanks for booking with us!<br />- QuickShow Team</p>
//           </div>`,
//             });

//             console.log('Booking confirmation email sent to:', booking.user.email);
            
//         } catch (error) {
//             console.error('Error in sendBookingConfirmationEmail:', error);
//             throw error;
//         }
//     }
// );

// // Inngest function to send reminders
// const sendShowReminders = inngest.createFunction(
//     { id: "send-show-reminders" },
//     { cron: "0 */8 * * *" }, // Every 8 hours
//     async ({ step }) => {
//         const now = new Date();
//         const in8Hours = new Date(now.getTime() + 8 * 60 * 60 * 1000);

//         // prepare reminder tasks
//         const reminderTasks = await step.run(
//             "prepare-reminder-tasks",
//             async () => {
//                 try {
//                     const shows = await Show.find({
//                         showTime: { $gte: now, $lte: in8Hours }, // Fixed: was using undefined windowStart
//                     }).populate('movie');

//                     const tasks = [];

//                     for (const show of shows) {
//                         if (!show.movie || !show.occupiedSeats) continue;

//                         const userIds = [...new Set(Object.values(show.occupiedSeats))];
//                         if (userIds.length === 0) continue;

//                         const users = await User.find({ _id: { $in: userIds } }).select("name email");

//                         for (const user of users) {
//                             tasks.push({
//                                 userEmail: user.email,
//                                 userName: user.name,
//                                 movieTitle: show.movie.title,
//                                 showTime: show.showTime,
//                             });
//                         }
//                     }

//                     return tasks;
//                 } catch (error) {
//                     console.error('Error preparing reminder tasks:', error);
//                     return [];
//                 }
//             }
//         );

//         if (reminderTasks.length === 0) {
//             return { sent: 0, message: "No reminders to send." };
//         }

//         // Send reminder emails
//         const results = await step.run('send-all-reminders', async () => {
//             return await Promise.allSettled(
//                 reminderTasks.map(task => sendEmail({
//                     to: task.userEmail,
//                     subject: `Reminder: Your movie "${task.movieTitle}" starts soon!`,
//                     body: `<div style="font-family: Arial, sans-serif; padding: 20px;">
//                                 <h2>Hello ${task.userName},</h2>
//                                 <p>This is a quick reminder that your movie:</p>
//                                 <h3 style="color: #F84565">${task.movieTitle}</h3>
//                                 <p>
//                                  is scheduled for <strong>${new Date(task.showTime).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}</strong> at 
//                                  <strong>${new Date(task.showTime).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })}</strong>.
//                                 </p>
//                                 <p>It starts in approximately <strong>8 hours</strong>
//                                 - make sure you're ready!</p>
//                                 <p>Enjoy the show!<br />- QuickShow Team</p>
//                             </div>`,
//                 }))
//             );
//         });

//         const sent = results.filter(r => r.status === "fulfilled").length; // Fixed: was using undefined variable
//         const failed = results.length - sent;

//         return {
//             sent,
//             failed,
//             message: `Sent ${sent} reminder(s), ${failed} failed.`
//         };
//     }
// );

// // Inngest function to send notification when a new show is added
// const sendNewShowNotifications = inngest.createFunction(
//     { id: "send-new-show-notifications" },
//     { event: "app/show.added" },
//     async ({ event }) => {
//         try {
//             const { movieTitle } = event.data;

//             const users = await User.find({}).select('name email'); // Fixed: was using User.email

//             for (const user of users) {
//                 const userEmail = user.email;
//                 const userName = user.name;

//                 const subject = `🎬 New Show Added: ${movieTitle}`;
//                 const body = `<div style="font-family: Arial, sans-serif; padding: 20px;">
//                                     <h2>Hi ${userName},</h2>
//                                     <p>We've just added a new show to our library:</p>
//                                     <h3 style="color: #F84565">${movieTitle}</h3>
//                                     <p>Visit our website to book your tickets!</p>
//                                     <br />
//                                     <p>Thanks<br />- QuickShow Team</p>
//                                 </div>`;

//                 await sendEmail({
//                     to: userEmail,
//                     subject,
//                     body,
//                 });
//             }

//             return { message: "Notifications sent." };
            
//         } catch (error) {
//             console.error('Error in sendNewShowNotifications:', error);
//             throw error;
//         }
//     }
// );

// // Export all Inngest functions
// export const functions = [
//     syncUserCreation,
//     syncUserDeletion,
//     syncUserUpdation,
//     releaseSeatsAndDeleteBooking,
//     sendBookingConfirmationEmail,
//     sendShowReminders,
//     sendNewShowNotifications
// ];