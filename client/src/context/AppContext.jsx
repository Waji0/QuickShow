import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

export const AppContext = createContext();

export const AppProvider = ({ children }) => {

    const [isAdmin, setIsAdmin] = useState(null);
    const [shows, setShows] = useState([]);
    const [favoriteMovies, setFavoriteMovies] = useState([]);

    const image_base_url = import.meta.env.VITE_TMDB_IMAGE_BASE_URL;

    const {user} = useUser();
    // const {getToken} = useAuth();
    const { getToken, isSignedIn } = useAuth(); // via claude
    const location = useLocation();
    const navigate = useNavigate();


        // Test function to check authentication
    // const testAuth = async () => {
    //     try {
    //         const token = await getToken();
    //         console.log("Testing auth with token:", token ? "Token present" : "No token");
            
    //         const { data } = await axios.get("/api/test-auth", {
    //             headers: { Authorization: `Bearer ${token}` },
    //         });
            
    //         console.log("Auth test result:", data);
    //         return data;
    //     } catch (error) {
    //         console.error("Auth test failed:", error.response?.data || error.message);
    //         return null;
    //     }
    // };

    // line break

    // const fetchIsAdmin = async () => {
    //     try {
            
    //         // const {data} = await axios.get('/api/admin/is-admin', {
    //         //     headers: {Authorization: `Bearer ${await getToken()}`}
    //         // });

    //         const token = await getToken();
    //         // console.log("Token being sent:", token);

    //         const { data } = await axios.get("/api/admin/is-admin", {
    //           headers: { Authorization: `Bearer ${token}` },
    //         });

            
    //         setIsAdmin(data.isAdmin);

    //         if(!data.isAdmin && location.pathname.startsWith('/admin')) {
    //             navigate('/');
    //             toast.error('You are not authorized to access admin dashboard');
    //         }

    //     } catch (error) {
    //         console.error(error);
    //     }
    // };


    const fetchIsAdmin = async () => {
        try {
            // First test basic auth
            // const authTest = await testAuth();
            // if (!authTest?.success) {
            //     console.log("Auth test failed, user might not be authenticated");
            //     return;
            // }

            const token = await getToken();
            // console.log("Token being sent for admin check:", token ? "Token present" : "No token");

            const { data } = await axios.get("/api/admin/is-admin", {
                headers: { Authorization: `Bearer ${token}` },
            });

            // console.log("Admin check result:", data);
            setIsAdmin(data.isAdmin);

            if (!data.isAdmin && location.pathname.startsWith('/admin')) {
                navigate('/');
                toast.error('You are not authorized to access admin dashboard');
            }

        } catch (error) {
            console.error("fetchIsAdmin error:", error.response?.data || error.message);
            setIsAdmin(false);
            
            if (location.pathname.startsWith('/admin')) {
                navigate('/');
                toast.error('You are not authorized to access admin dashboard');
            }
        }
    };

    const fetchShows = async () => {
        try {
            const { data } = await axios.get('/api/show/all');

            if (data.success) {
                setShows(data.shows);
            } else {
                toast.error(data.message);
            }

        } catch (error) {
            console.error("fetchShows error:", error);
        }
    };

    const fetchFavoriteMovies = async () => {
        try {
            const token = await getToken();
            const { data } = await axios.get('/api/user/favorites', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                setFavoriteMovies(data.movies);
            } else {
                toast.error(data.message);
            }

        } catch (error) {
            console.error("fetchFavoriteMovies error:", error);
        }
    };

    useEffect(() => {
        fetchShows();
    }, []);

    useEffect(() => {
        // if(user) {
        // Only fetch admin status if user is signed in and user object is loaded
        if (user && isSignedIn) {
            console.log("User is signed in, fetching admin status...");
            fetchIsAdmin();
            fetchFavoriteMovies();
        } else {
            console.log("User not signed in or user object not loaded yet");
            setIsAdmin(null);
        }
    // }, [user]);
    }, [user, isSignedIn, location.pathname]);

    const value = {
        axios,
        fetchIsAdmin,
        // testAuth, // Add this for debugging
        user, 
        getToken, 
        navigate, 
        isAdmin, 
        shows,
        favoriteMovies, 
        fetchFavoriteMovies,
        image_base_url
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    return useContext(AppContext);
};