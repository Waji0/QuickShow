import { assets } from '../assets/assets'
import { ArrowRight, CalendarRange, ClockIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

const HeroSection = () => {

    const navigate = useNavigate();

  return (
    <div className='flex flex-col items-start justify-center gap-4 px-6 md:px-16 lg:px-36 bg-[url("/backgroundImage.png")] bg-cover bg-center h-screen'>
      
      <img src={assets.marvelLogo} alt='Marvel Logo' className='max-h-11 lg:h-11 mt-20' />
      
      <h1 className='text-5xl md:text-[70px] md:leading-[80px] font-semibold max-w-[28rem]'>
        Guardians <br /> of the Galaxy
      </h1>

      <div className='flex items-center gap-4 text-gray-300'>
        <span>Action | Adventure | Sci-Fi</span>
        <div className='flex items-center gap-1'>
          <CalendarRange className='w-4 h-4' /> 2018
        </div>
        <div className='flex items-center gap-1'>
          <ClockIcon className='w-4 h-4' /> 2h 8m
        </div>

        <p className='max-w-md text-gray-300'>A bunch of skilled criminals led by brash adventurer Peter Quill join hands to fight a villain named Ronan the Accuser who wants to control the universe with the help of a mystical orb.</p>
        <button className='flex items-center gap-1 px-6 py-3 text-sm [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-dull)] transition rounded-full font-medium cursor-pointer' onClick={() => {
          navigate('/movies');
        }}>
            Explore Movies
            <ArrowRight className='w-5 h-5'/>
        </button>

      </div>
    </div>
  );
};


export default HeroSection
