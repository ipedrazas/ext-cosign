import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { Box, TableContainer, Table, Paper, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { blueGrey } from "@mui/material/colors"
import {CheckCircle} from '@mui/icons-material';


// Note: This line relies on Docker Desktop's presence as a host application.
// If you're running this React app in a browser, it won't work properly.
const client = createDockerDesktopClient();

function useDockerDesktopClient() {
  return client;
}


export function VerifiedIcon(props: {status: boolean}){
  const {status} = props;
  if (status) {
      return(<CheckCircle style={{ color: "#74ca74" }}/>);
  } else {
    // return(<Cancel style={{ color: "#a587bb" }}/>);
    return(null)
  }
}


function ImageRow(props: {image: any}){
  const {image} = props;
    return(
      <TableRow
        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
      >
        <TableCell component="th" scope="row">
          {image.repoName}
        </TableCell>

        <TableCell align="right">{image.tag}</TableCell>
        <TableCell align="right">{image.digest}</TableCell>
        <TableCell align="right">
        <VerifiedIcon status={image.verified} />
        </TableCell>
      </TableRow>
    );
}

export function App() {
  const ddClient = useDockerDesktopClient();
  const [images, setImages] = useState(null);
  const [verified, setVerifiedImages] = useState(null);
  const [isLoading, setIsLoading] = React.useState(false);

  function parseImage(image){
    if (image && image.RepoTags.length > 0 && image.RepoDigests.length > 0){
      let tagParts = image.RepoTags[0].split(":");
      let digestParts = image.RepoDigests[0].split("@");
      let nParts = tagParts[0].split("/");
  
      let dimg = {
        repoTag: image.RepoTags[0],
        repoName: tagParts[0],
        digestParts: image.RepoDigests[0],
        name: "",
        tag: tagParts[1],
        digest: digestParts[1],
        verified: false,
        registry: "",
        user: "",
      }
      if (tagParts.length === 3){
        // has registry
        dimg.registry = nParts[0]
        dimg.user = nParts[1]
        dimg.name = nParts[2]
      }
      if (tagParts.length === 2){
        dimg.user = nParts[0]
        dimg.name = nParts[1]
      }
      
      return dimg;
    }
    return null;
  }

  async function CheckSignature(img:any) {
    // console.log(img);
    try {
      const result = await ddClient.extension.vm?.cli.exec("/data/bin/linux/cosign", [
        "verify",
        "--key",
        "/data/cosign.pub",
        img.repoTag
      ]);
      console.log(result);
      img.verified = true;
      return true;
    } catch (error) {
      console.log(error);
    }
    return false;
  }

  async function fetchImages() {
    setIsLoading(true);
    await ddClient.docker.listImages().then((result: []) => {
      console.log(result);
      let imgs = [];
      result.forEach(element => {
        let img = parseImage(element);
        CheckSignature(img).then((isVerified: boolean) => {
          img.verified = isVerified;
        })
        imgs.push(img);
      });
      setImages(imgs);
      setIsLoading(false);
    });
  }

  const verifyImages = async () => {
    let verified = [];
    console.log(images);
    images.forEach(img => {
      CheckSignature(img).then((isSigned: boolean) => {
        if (isSigned){
          img.verified = true;
          verified.push(img);
         }
      });
    });
    setImages(images);
    setVerifiedImages(verified);
    
  }


  useEffect(() => {
    const initImages = async () => {
      await fetchImages()
    };
    initImages();
  },[]);

  if (isLoading) {
    return <Box sx={{
        marginBottom: "15px",
        textAlign: "center"
    }}>
        <CircularProgress
            size={50}
            sx={{
                color: blueGrey[500],
            }}
        />
    </Box>
} else{
  return (
    <>
        <Button variant="contained" onClick={verifyImages}>
            Verify Images
          </Button>
        <TableContainer component={Paper}>
          <Table size="small" aria-label="a dense table">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Tag</TableCell>
                <TableCell align="right">Digest</TableCell>
                <TableCell align="right">Verified</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {images?.map((row, index) => (
                <ImageRow key={index} image={row} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>

    </>
    );
  }
}