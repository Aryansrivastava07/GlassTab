import React, { useState, useEffect } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  initializeUserData,
  addSpeedDial,
  deleteSpeedDial,
  subscribeToUserData,
} from "../services/databaseService";
import { getCachedUserData } from "../utils/cacheService";

const SpeedDials = () => {
  const { currentUser } = useAuth();
  const [speedDials, setSpeedDials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", url: "", logo: "" });

  useEffect(() => {
    if (!currentUser) {
      setSpeedDials([]);
      setLoading(false);
      return;
    }

    // Load cached data immediately for faster UI
    const cachedData = getCachedUserData(currentUser.uid);
    if (cachedData && cachedData.speedDials) {
      setSpeedDials(cachedData.speedDials);
      setLoading(false);
    }

    // Initialize user data and subscribe to real-time updates
    initializeUserData(currentUser.uid);

    const unsubscribe = subscribeToUserData(currentUser.uid, (userData) => {
      if (userData) {
        setSpeedDials(userData.speedDials || []);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!currentUser || !newItem.name || !newItem.url) return;

    try {
      const item = {
        name: newItem.name,
        url: newItem.url,
        logo:
          newItem.logo ||
          `https://www.google.com/s2/favicons?domain=${new URL(newItem.url).hostname}&sz=256`,
      };

      await addSpeedDial(currentUser.uid, item);
      setNewItem({ name: "", url: "", logo: "" });
      setShowAddDialog(false);
    } catch (error) {
      console.error("Error adding speed dial:", error);
      // Show user-friendly error message
      alert("Failed to add speed dial. Please try again.");
    }
  };

  const handleDeleteItem = async (id) => {
    if (!currentUser) return;

    try {
      await deleteSpeedDial(currentUser.uid, id);
    } catch (error) {
      console.error("Error deleting speed dial:", error);
      // Show user-friendly error message
      alert("Failed to delete speed dial. Please try again.");
    }
  };

  if (loading && speedDials.length === 0) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Please login to manage your speed dials</p>
      </div>
    );
  }
  return (
    <div>
      <div className="w-full flex gap-6 mb-4">
        {speedDials.map((item) => (
          <div
            key={item.id}
            className="px-8 py-4 bg-black/30 backdrop-blur-md rounded-lg relative hover:border-white/30 border border-white/10 transition cursor-pointer group"
          >
            <a href={item.url} rel="noopener noreferrer" className="">
              <img
                src={item.logo}
                alt={item.name}
                className="w-20 h-20 mx-auto mb-2 rounded-lg"
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${item.name}&background=random`;
                }}
              />
              <p className="text-sm text-center text-white font-medium">
                {item.name}
              </p>
            </a>
            <button
              onClick={() => handleDeleteItem(item.id)}
              className="absolute top-1 right-1 text-[#ff5770] rounded-full p-1 opacity-0 transition group-hover:opacity-100 hover:bg-[#ff7271]/30 hover:text-[#ff3271]"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div
          className="m-auto p-8 flex items-center justify-center h-fit w-fit bg-white/10 backdrop-blur-md rounded-lg cursor-pointer hover:bg-white/20 transition"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus size={24} />
        </div>
        {showAddDialog && (
          <dialog
            className="m-auto p-8 top-1/2 transform -translate-y-2/3 bg-black/80 backdrop-blur-md z-10 rounded-lg"
            id="addDialog"
            open
          >
            <h3 className="text-white text-xl mb-6">
              Add your Favourite websites!
            </h3>
            <form onSubmit={handleAddItem}>
              <div className="formGroup">
                <label htmlFor="Name" className="text-gray-300 block mb-2">
                  Name
                </label>
                <input
                  type="text"
                  id="Name"
                  value={newItem.name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, name: e.target.value })
                  }
                  placeholder="Name of Website"
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white placeholder-gray-400 mb-4"
                  required
                />
              </div>
              <div className="formGroup">
                <label htmlFor="URL" className="text-gray-300 block mb-2">
                  URL
                </label>
                <input
                  type="url"
                  id="URL"
                  value={newItem.url}
                  onChange={(e) =>
                    setNewItem({ ...newItem, url: e.target.value })
                  }
                  placeholder="Url of Website"
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white placeholder-gray-400 mb-4"
                  required
                />
              </div>
              <div className="formGroup">
                <label htmlFor="Logo" className="text-gray-300 block mb-2">
                  Logo
                </label>
                <input
                  type="url"
                  id="Logo"
                  value={newItem.logo}
                  onChange={(e) =>
                    setNewItem({ ...newItem, logo: e.target.value })
                  }
                  placeholder="Url of image (optional)"
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white placeholder-gray-400 mb-6"
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                >
                  Add
                </button>
              </div>
            </form>
            <button
              type="button"
              onClick={() => setShowAddDialog(false)}
              className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition"
            >
              Cancel
            </button>
          </dialog>
        )}
      </div>
    </div>
  );
};

//   return (
//     <div>
//       <div className="appContainer self-center relative">
//         {speedDials.map((item) => (
//           <div key={item.id} className="speedDial">
//             <a
//               href={item.url}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="block"
//             >
//               <img
//                 src={item.logo}
//                 alt={item.name}
//                 className="w-16 h-16 mx-auto mb-2 rounded-lg"
//                 onError={(e) => {
//                   e.target.src = `https://ui-avatars.com/api/?name=${item.name}&background=random`;
//                 }}
//               />
//               <p className="text-sm text-center text-white font-medium">
//                 {item.name}
//               </p>
//             </a>
//             <button
//               onClick={() => handleDeleteItem(item.id)}
//               className="deleteBtn"
//             >
//               <X size={16} />
//             </button>
//           </div>
//         ))}

//         <div className="appContainerAdd" onClick={() => setShowAddDialog(true)}>
//           <Plus size={24} />
//         </div>
//       </div>

//       {showAddDialog && (
//         <div className="dialogOverlay">
//           <div className="dialog dark-glass">
//             <h3 className="text-white text-xl mb-6">
//               Add your Favourite websites!
//             </h3>
//             <form onSubmit={handleAddItem}>
//               <div className="formGroup">
//                 <label htmlFor="Name" className="text-gray-300">
//                   Name
//                 </label>
//                 <input
//                   type="text"
//                   id="Name"
//                   value={newItem.name}
//                   onChange={(e) =>
//                     setNewItem({ ...newItem, name: e.target.value })
//                   }
//                   placeholder="Name of Website"
//                   className="bg-white/10 border-white/20 text-white placeholder-gray-400"
//                   required
//                 />
//               </div>
//               <div className="formGroup">
//                 <label htmlFor="URL" className="text-gray-300">
//                   URL
//                 </label>
//                 <input
//                   type="url"
//                   id="URL"
//                   value={newItem.url}
//                   onChange={(e) =>
//                     setNewItem({ ...newItem, url: e.target.value })
//                   }
//                   placeholder="Url of Website"
//                   className="bg-white/10 border-white/20 text-white placeholder-gray-400"
//                   required
//                 />
//               </div>
//               <div className="formGroup">
//                 <label htmlFor="Logo" className="text-gray-300">
//                   Logo
//                 </label>
//                 <input
//                   type="url"
//                   id="Logo"
//                   value={newItem.logo}
//                   onChange={(e) =>
//                     setNewItem({ ...newItem, logo: e.target.value })
//                   }
//                   placeholder="Url of image (optional)"
//                   className="bg-white/10 border-white/20 text-white placeholder-gray-400"
//                 />
//               </div>
//               <div className="formButtons">
//                 <button type="submit" className="btnAdd">
//                   Add
//                 </button>
//                 <button
//                   type="button"
//                   className="btnCancel"
//                   onClick={() => setShowAddDialog(false)}
//                 >
//                   Cancel
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       <style>{`
//       .appContainer {
//         display: grid;
//         grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
//         gap: 1.5rem;
//         max-width: 800px;
//         margin: 0 auto;
//         padding: 0 1rem;
//       }

//       .speedDial {
//         position: relative;
//         background: rgba(255, 255, 255, 0.08);
//         backdrop-filter: blur(12px);
//         border: 1px solid rgba(255, 255, 255, 0.1);
//         border-radius: 16px;
//         padding: 1.5rem 1rem;
//         box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.3);
//         transition: all 0.3s ease;
//         cursor: pointer;
//       }

//       .speedDial:hover {
//         background: rgba(255, 255, 255, 0.15);
//         border-color: rgba(255, 255, 255, 0.2);
//         box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.4);
//         transform: translateY(-2px);
//       }

//       .deleteBtn {
//         position: absolute;
//         top: -8px;
//         right: -8px;
//         background: rgba(239, 68, 68, 0.8);
//         backdrop-filter: blur(10px);
//         color: white;
//         border: 1px solid rgba(255, 255, 255, 0.1);
//         border-radius: 50%;
//         width: 24px;
//         height: 24px;
//         display: flex;
//         align-items: center;
//         justify-content: center;
//         cursor: pointer;
//         opacity: 0;
//         transition: all 0.2s ease;
//       }

//       .speedDial:hover .deleteBtn {
//         opacity: 1;
//       }

//       .deleteBtn:hover {
//         background: rgba(239, 68, 68, 1);
//       }

//       .appContainerAdd {
//         background: rgba(255, 255, 255, 0.08);
//         backdrop-filter: blur(12px);
//         border: 2px dashed rgba(255, 255, 255, 0.2);
//         border-radius: 16px;
//         padding: 2rem;
//         display: flex;
//         align-items: center;
//         justify-content: center;
//         color: rgba(255, 255, 255, 0.6);
//         cursor: pointer;
//         transition: all 0.3s ease;
//         min-height: 120px;
//       }

//       .appContainerAdd:hover {
//         background: rgba(255, 255, 255, 0.15);
//         border-color: rgba(255, 255, 255, 0.4);
//         color: rgba(255, 255, 255, 0.8);
//         transform: translateY(-2px);
//         box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.4);
//       }

//       .dialogOverlay {
//         position: fixed;
//         top: 0;
//         left: 0;
//         right: 0;
//         bottom: 0;
//         background: rgba(0, 0, 0, 0.7);
//         backdrop-filter: blur(8px);
//         display: flex;
//         align-items: center;
//         justify-content: center;
//         z-index: 1000;
//       }

//       .dialog {
//         background: rgba(0, 0, 0, 0.8);
//         backdrop-filter: blur(20px);
//         border: 1px solid rgba(255, 255, 255, 0.1);
//         border-radius: 20px;
//         padding: 2rem;
//         max-width: 400px;
//         width: 90%;
//         box-shadow: 0 20px 40px 0 rgba(0, 0, 0, 0.5);
//       }

//       .formGroup {
//         margin-bottom: 1.5rem;
//       }

//       .formGroup label {
//         display: block;
//         margin-bottom: 0.5rem;
//         font-weight: 500;
//       }

//       .formGroup input {
//         width: 100%;
//         padding: 0.75rem;
//         border: 1px solid;
//         border-radius: 12px;
//         font-size: 1rem;
//         background: transparent;
//         transition: all 0.3s ease;
//       }

//       .formGroup input:focus {
//         outline: none;
//         border-color: rgba(255, 255, 255, 0.4);
//         background: rgba(255, 255, 255, 0.05);
//       }

//       .formButtons {
//         display: flex;
//         gap: 1rem;
//         margin-top: 2rem;
//       }

//       .btnAdd, .btnCancel {
//         flex: 1;
//         padding: 0.75rem;
//         border: none;
//         border-radius: 12px;
//         font-weight: 500;
//         cursor: pointer;
//         transition: all 0.3s ease;
//       }

//       .btnAdd {
//         background: rgba(16, 185, 129, 0.8);
//         backdrop-filter: blur(10px);
//         color: white;
//         border: 1px solid rgba(255, 255, 255, 0.1);
//       }

//       .btnAdd:hover {
//         background: rgba(16, 185, 129, 1);
//         transform: translateY(-1px);
//       }

//       .btnCancel {
//         background: rgba(107, 114, 128, 0.8);
//         backdrop-filter: blur(10px);
//         color: white;
//         border: 1px solid rgba(255, 255, 255, 0.1);
//       }

//       .btnCancel:hover {
//         background: rgba(107, 114, 128, 1);
//         transform: translateY(-1px);
//       }
//     `}</style>
//     </div>
//   );
// };

export default SpeedDials;
