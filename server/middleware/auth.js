import { clerkClient } from '@clerk/express';



// export const protectAdmin = async (req, res, next) => {
//     try {

//         // const { userId } = req.auth; //is deprecated
//         const { userId } = req.auth();
//         console.log(userId);
//         const user = await clerkClient.users.getUser(userId);

//         console.log(user.privateMetadata.role);
        
//         if (user.privateMetadata.role !== 'admin') {
//             return res.json({success: false, message: "not authorized"});
//         }

//         next();

//     } catch (error) {
//         return res.json({success: false, message: "not authorized"});
//     }
// };


export const protectAdmin = async (req, res, next) => {
    try {
        // Use req.auth() as a function (newer Clerk version)
        const { userId } = req.auth();
        
        // console.log('User ID:', userId);
        // console.log('Full auth object:', req.auth());
        // console.log('Request headers:', req.headers.authorization);
        
        // Check if userId exists
        if (!userId) {
            return res.status(401).json({
                success: false, 
                message: "not authorized - no user ID found. Please make sure you're logged in."
            });
        }
        
        const user = await clerkClient.users.getUser(userId);
        // console.log('User private metadata:', user.privateMetadata);
        // console.log('User role:', user.privateMetadata?.role);
        
        if (user.privateMetadata?.role !== 'admin') {
            return res.status(403).json({
                success: false, 
                message: "not authorized - admin access required"
            });
        }
        
        next();
    } catch (error) {
        console.error('Error in protectAdmin:', error);
        return res.status(500).json({
            success: false, 
            message: "not authorized - error occurred",
            error: error.message
        });
    }
};