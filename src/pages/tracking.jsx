import { useSearchParams, useNavigate } from "react-router-dom";
import RouteTrackingMap from "../components/common/routeTrackingMap";

const Tracking = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const salesId = searchParams.get('salesId');

    return (
        <div className='relative'>
            {/* Top action bar outside the red header */}
            <div className="flex justify-end items-center px-4 py-2 bg-transparent">
                <button
                    onClick={() => navigate(`/attendance-tracking/tracking-report?salesId=${salesId || ''}`)}
                    className="px-4 py-2 bg-[#FF5934] text-white rounded-md shadow hover:bg-[#e55031]"
                >
                    Report
                </button>
            </div>
            <RouteTrackingMap salesId={salesId} />
        </div>
    );
}

export default Tracking;