import React, { ChangeEvent, useState } from "react";
import type { FeatureCollection } from "geojson";
import "./Floating.css"
import axios from "axios";

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface FloatingProps {
    handleGeoJSON?: (fc: any) => void;
}

export default function Floating({handleGeoJSON} : FloatingProps) {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);

    function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
        if (e.target.files) {
            const selectedFile = e.target.files[0];

            //Handle Allowerd
            const allowedExtensions = ["kml", "kmz"];
            const fileExtensionn = selectedFile.name.split('.').pop()?.toLowerCase();

            
            if (!fileExtensionn || !allowedExtensions.includes(fileExtensionn)) {
                alert("Invalid file type! Please upload a .KMZ file");
                setFile(null);
                return;
            } else {
                setFile(selectedFile);
            }

        }
    }

    async function handleFileUpload() {
        if (!file) return;

        setStatus("uploading");
        setUploadProgress(0); // Reset on call

        const formData = new FormData();
        formData.append('file', file);

        try {
            const {data} = await axios.post(
                "http://localhost:3000/api/upload", 
                formData, 
                {
                
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    onUploadProgress: (progressEvent) => {
                        const progress = progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0;
                        setUploadProgress(progress);
                    
                    },
                }
            );

            setStatus("success");
            setUploadProgress(100);

            if (data?.ok && data?.geojson && handleGeoJSON) {
                handleGeoJSON(data.geojson as FeatureCollection)
            }
        } catch {
            setStatus("error");
            setUploadProgress(0);
        }
    }


    return(
        <>
            <div className="Floating">
                <div className="file-wrapper"> 
                    <input className="file" 
                    type="file" 
                    name="file"
                    accept=".kml,.kmz"
                    onChange={handleFileChange} 
                    >

                    </input>
                    { file && (
                        <div className="file-info"> 
                            <p> File Name: {file.name} </p>
                            <p> File Size: {(file.size / 1024).toFixed(2)} </p>
                            <p> File Type: {file.type} </p>
                        </div>
                    )}
                    { file && status !== 'uploading' && <button className="upload-btn" onClick={handleFileUpload}> Upload </button>}
                    
                    { status === 'uploading' && (
                        <div className="upload">
                            <div className="upload-wrapper"> 
                                <div className="upload-bar" 
                                style={{width: `${uploadProgress}%`}}
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={uploadProgress} /> 
                            </div>
                            <p> {uploadProgress}% upload progress </p> 
                        </div>
                    )}

                    { status === 'success' && ( <p> File Uploaded Successfully! </p>)}
                    { status === 'error' && ( <p> File Upload Failed! </p>)}

                </div>
            </div>
        </>
    );
};
