import React, { useEffect } from 'react'

const EscapeClose = ({onClose}) => {
    useEffect(() => {
        const handleEscapeKey = (event) => {
          if (event.key === 'Escape') {
            onClose();
          }
        };
    
        document.addEventListener('keydown', handleEscapeKey);
        return () => {
          document.removeEventListener('keydown', handleEscapeKey);
        };
      }, [onClose]);
  return null;
}

export default EscapeClose