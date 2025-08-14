import { clerkClient } from '@clerk/express';



// export const protectAdmin = async (req, res, next) => {
//     try {

//         // const { userId } = req.auth; //is deprecated
//         const { userId } = req.auth();
//         console.log(userId);
//         const user = await clerkClient.users.getUser(userId);
        
//         if (user.privateMetadata.role !== 'admin') {
//             return res.json({success: false, message: "not authorized"});
//         }

//         next();

//     } catch (error) {
//         return res.json({success: false, message: "not authorized"});
//     }
// };


// export const protectAdmin = async (req, res, next) => {
//     try {
//         const { userId } = req.auth; // ✅ don't call as function

//         if (!userId) {
//             console.log("No userId found in req.auth:", req.auth);
//             return res.status(401).json({ success: false, message: "No user ID found" });
//         }

//         const user = await clerkClient.users.getUser(userId);

//         // Debug logs
//         console.log("Clerk user object:", JSON.stringify(user, null, 2));
//         console.log("Private Metadata:", user.privateMetadata);

//         if (user.privateMetadata.role !== "admin") {
//             console.log("User is not admin, role =", user.privateMetadata.role);
//             return res.status(403).json({ success: false, message: "not authorized" });
//         }

//         console.log("✅ User authorized as admin:", userId);
//         next();
//     } catch (error) {
//         console.error("protectAdmin error:", error);
//         return res.status(500).json({ success: false, message: "Internal server error" });
//     }
// };




export const protectAdmin = async (req, res, next) => {
    try {
        const authData = req.auth?.(); // ✅ new Clerk API

        console.log("Auth data from Clerk:", authData);

        if (!authData?.userId) {
            return res.status(401).json({ success: false, message: "Unauthorized - No userId" });
        }

        const user = await clerkClient.users.getUser(authData.userId);
        console.log("Private metadata:", user.privateMetadata);

        if (user.privateMetadata.role !== "admin") {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        next();
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};



