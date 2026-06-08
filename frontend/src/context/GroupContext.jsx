import { createContext, useContext, useState, useCallback } from "react";
import { groupAPI } from "../api/groups";

const GroupContext = createContext(null);

export function GroupProvider({ children }) {
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await groupAPI.getAll();
      setGroups(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGroupDetails = useCallback(async (id) => {
    setLoading(true);
    try {
      const data = await groupAPI.getOne(id);
      setCurrentGroup(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const createGroup = async (name) => {
    const data = await groupAPI.create({ name });
    setGroups((prev) => [data, ...prev]);
    return data;
  };

  return (
    <GroupContext.Provider
      value={{ 
        groups, 
        currentGroup, 
        loading, 
        fetchGroups, 
        fetchGroupDetails, 
        createGroup,
        setCurrentGroup 
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export const useGroups = () => useContext(GroupContext);
