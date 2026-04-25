/* eslint-disable react/prop-types */
import '../../CSS/Card.css'; // Adjusted path

const Card = ({ title, price }) => {
  return (
    <div className='h-[120px] w-[200px] flex flex-col bg-[#FFFFFF] p-5 rounded-xl mt-2 gap-2 justify-center'>
      <h3 className='title'>{title}</h3>
      <h1 className='price text-2xl font-bold'>{price}</h1>
    </div>
  );
}

export default Card;
