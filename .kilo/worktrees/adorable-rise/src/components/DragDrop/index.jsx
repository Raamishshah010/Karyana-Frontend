/* eslint-disable react/prop-types */
import  { useEffect, useState } from "react";
import { AiOutlineCheckCircle } from "react-icons/ai";
import { MdClear } from "react-icons/md";

const DragNdrop = ({
  onFilesSelected,
  width,
  height,
}) => {
  const [files, setFiles] = useState([]);

  const handleFileChange = (event) => {
    const selectedFiles = event.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const newFiles = Array.from(selectedFiles);
      setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    }
  };
  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const newFiles = Array.from(droppedFiles);
      setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  useEffect(() => {
    onFilesSelected(files);
  }, [files, onFilesSelected]);

  return (
    <section className="drag-drop absolute" style={{ width: width, height: height }}>
      <div
        className={`document-uploader ${
          files.length > 0 ? "upload-box active" : "upload-box"
        } flex flex-col justify-end h-full`}
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
      >
        <>
          <div className="upload-info">
            <div className="flex justify-center">
              <label htmlFor="browse" className='text-red-500 mb-1'>Click to upload or drag and drop</label>
            </div>
          </div>
          <input
            type="file"
            hidden
            id="browse"
            onChange={handleFileChange}
            accept="image/*"
            multiple
          />
          <label htmlFor="browse" className=' text-[#FF5934] text-nowrap  flex justify-center p-2 rounded'>
            {/* Browse files */}
            <p className='text-xs text-gray-400'>JPG, PNG etc (max. 10MB)</p>
          </label>
        </>

        {files.length > 0 && (
          <div className="file-list">
            <div className="file-list__container">
              {files.map((file, index) => (
                <div className="file-item" key={index}>
                  <div className="file-info">
                    <p>{file.name}</p>
                    {/* <p>{file.type}</p> */}
                  </div>
                  <div className="file-actions">
                    <MdClear onClick={() => handleRemoveFile(index)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className="success-file">
            <AiOutlineCheckCircle
              style={{ color: "#6DC24B", marginRight: 1 }}
            />
            <p>{files.length} file(s) selected</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default DragNdrop;