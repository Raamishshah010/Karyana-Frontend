import { getDashboardData } from '../APIS';
import Card from '../components/Card/Card'
import { Loader } from '../components/common/loader'
import useSWR from "swr";

const Dashboard = () => {
  const { data } = useSWR("/getDashboardData", () =>
    getDashboardData()
  );
  if (!data) return <Loader />;
  return (
    <>
    <h1 className='font-bold text-2xl my-5'>Dashboard</h1>
    <div className='md:flex w-full flex-wrap md:gap-y-5 gap-x-10 overflow-hidden'>
      {data.data.map((item) => (
        <Card key={item.label} title={item.label} price={item.value} />
      ))}
    </div>
    </>
  )
}

export default Dashboard